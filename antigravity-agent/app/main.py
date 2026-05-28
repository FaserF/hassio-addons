import os
import sys
import re
import uuid
import shutil
import logging
import threading
import subprocess
import requests
from fastapi import FastAPI, BackgroundTasks, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Dict, Optional, List

# Setup Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("antigravity-agent")

app = FastAPI(title="Antigravity Agent API", version="1.0.0")

# In-memory store for task states
tasks_db: Dict[str, dict] = {}

class TaskRequest(BaseModel):
    repository: str = Field(..., description="The GitHub repository URL, e.g., 'https://github.com/owner/repo'")
    instruction: str = Field(..., description="Instruction of what feature to implement or bug to fix")
    branch: Optional[str] = Field(None, description="Target branch name. If not specified, one will be generated.")
    github_token: Optional[str] = Field(None, description="GitHub token to clone and create PR. Fallback to addon config.")
    custom_instruction: Optional[str] = Field(None, description="Optional custom instruction overriding default preset.")

class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    message: str
    repository: str
    branch: str
    pr_url: Optional[str] = None

# Helper to send WhatsApp messages back
def send_whatsapp_message(number: str, text: str):
    if os.environ.get("WHATSAPP_ENABLED", "false").lower() != "true":
        return
    url = os.environ.get("WHATSAPP_URL", "http://localhost:8066")
    token = os.environ.get("WHATSAPP_TOKEN", "")
    
    headers = {}
    if token:
        headers["X-Auth-Token"] = token
        
    payload = {
        "number": number,
        "message": text
    }
    
    try:
        res = requests.post(f"{url}/send_message", json=payload, headers=headers, timeout=10)
        logger.info(f"WhatsApp notification sent status: {res.status_code}")
    except Exception as e:
        logger.error(f"Failed to send WhatsApp message: {e}")

# Helper to write task logs to a file
def log_task(task_id: str, message: str):
    logger.info(f"Task {task_id}: {message}")
    if task_id in tasks_db:
        tasks_db[task_id]["logs"].append(message)
    
    # Also persist to file
    log_dir = "/data/tasks"
    os.makedirs(log_dir, exist_ok=True)
    with open(f"{log_dir}/{task_id}.log", "a", encoding="utf-8") as f:
        f.write(message + "\n")

def parse_repo_url(url: str) -> tuple:
    url = url.strip()
    if url.endswith(".git"):
        url = url[:-4]
    
    if "github.com/" in url:
        parts = url.split("github.com/")[-1].split("/")
        if len(parts) >= 2:
            return parts[0], parts[1]
    elif "github.com:" in url:
        parts = url.split("github.com:")[-1].split("/")
        if len(parts) >= 2:
            return parts[0], parts[1]
            
    return None, None

def run_cmd(args: List[str], cwd: str = None, env: dict = None, task_id: str = None) -> tuple:
    log_task(task_id, f"Executing command: {' '.join(args)}")
    try:
        res = subprocess.run(
            args,
            cwd=cwd,
            env=env,
            capture_output=True,
            text=True,
            check=True
        )
        return res.stdout, res.stderr
    except subprocess.CalledProcessError as e:
        log_task(task_id, f"Command failed: {e}")
        log_task(task_id, f"Stdout: {e.stdout}")
        log_task(task_id, f"Stderr: {e.stderr}")
        raise e

def execute_agent_workflow(task_id: str, req: TaskRequest, notify_number: Optional[str] = None):
    tasks_db[task_id]["status"] = "running"
    log_task(task_id, "Starting Antigravity agent execution flow...")

    # Determine GitHub token
    gh_token = req.github_token or os.environ.get("GITHUB_TOKEN", "")
    if not gh_token:
        tasks_db[task_id]["status"] = "failed"
        err_msg = "ERROR: GitHub token not specified. Please configure it in the addon options or pass it in the request."
        log_task(task_id, err_msg)
        if notify_number:
            send_whatsapp_message(notify_number, f"❌ Task {task_id[:8]} failed: {err_msg}")
        return

    # 1. Parse repository and build clone URL
    owner, repo_name = parse_repo_url(req.repository)
    if not owner or not repo_name:
        tasks_db[task_id]["status"] = "failed"
        err_msg = f"ERROR: Failed to parse repository URL: {req.repository}"
        log_task(task_id, err_msg)
        if notify_number:
            send_whatsapp_message(notify_number, f"❌ Task {task_id[:8]} failed: {err_msg}")
        return
        
    log_task(task_id, f"Repository Parsed - Owner: {owner}, Name: {repo_name}")
    clone_url = f"https://{gh_token}@github.com/{owner}/{repo_name}.git"

    # Create workspace path
    workspace_dir = f"/data/workspaces/{task_id}"
    if os.path.exists(workspace_dir):
        shutil.rmtree(workspace_dir)
    os.makedirs(workspace_dir, exist_ok=True)

    try:
        # Prepare environment variables
        env = os.environ.copy()
        env["GITHUB_TOKEN"] = gh_token
        gemini_token = os.environ.get("GEMINI_TOKEN", "")
        if gemini_token:
            env["GEMINI_API_KEY"] = gemini_token

        # 2. Use Gemini CLI to build the English Prompt
        log_task(task_id, "Translating and refining request prompt via gemini-cli...")
        
        system_instruction = (
            "Translate the following user instruction to English if it is in another language, "
            "and refine it into a perfect Markdown formatted prompt for an autonomous AI coding agent "
            "named Antigravity. Be clear about the goal, the changes, and what files should be edited. "
            "Include instructions to commit the code cleanly. "
            "Output ONLY the markdown prompt content, no explanations or conversational text.\n\n"
            f"User Instruction: {req.instruction}\n\n"
        )
        
        try:
            out, _ = run_cmd(["gemini", system_instruction], env=env, task_id=task_id)
            enhanced_prompt = out.strip()
        except Exception:
            try:
                log_task(task_id, "Direct 'gemini' CLI execution failed, trying via npx...")
                out, _ = run_cmd(["npx", "@google/gemini-cli", system_instruction], env=env, task_id=task_id)
                enhanced_prompt = out.strip()
            except Exception as e:
                log_task(task_id, f"gemini-cli call failed ({e}), using raw user instruction as prompt.")
                enhanced_prompt = req.instruction

        log_task(task_id, f"Enhanced English Prompt:\n{enhanced_prompt}")

        # 3. Clone repository
        log_task(task_id, f"Cloning repository into {workspace_dir}...")
        run_cmd(["git", "clone", "--depth", "1", clone_url, workspace_dir], task_id=task_id)

        # Configure git user inside cloned workspace
        run_cmd(["git", "config", "user.name", "Antigravity Agent"], cwd=workspace_dir, task_id=task_id)
        run_cmd(["git", "config", "user.email", "antigravity-agent@homeassistant.local"], cwd=workspace_dir, task_id=task_id)

        # 4. Git checkout/create branch
        branch_name = req.branch or f"antigravity/patch-{uuid.uuid4().hex[:8]}"
        tasks_db[task_id]["branch"] = branch_name
        log_task(task_id, f"Creating and checking out branch: {branch_name}")
        run_cmd(["git", "checkout", "-b", branch_name], cwd=workspace_dir, task_id=task_id)

        # 5. Run Antigravity AI agent
        log_task(task_id, "Invoking Google Antigravity Agent on the workspace...")
        
        final_instruction = req.custom_instruction or os.environ.get("DEFAULT_INSTRUCTION", "")
        full_agent_prompt = (
            f"{enhanced_prompt}\n\n"
            f"--- General Instructions ---\n"
            f"{final_instruction}"
        )

        agent_success = False
        try:
            log_task(task_id, "Attempting execution via google-antigravity Python SDK...")
            import google.antigravity as agy
            config = agy.LocalAgentConfig(
                workspace_dir=workspace_dir,
                api_key=env.get("GEMINI_API_KEY", "")
            )
            agent = agy.Agent(config)
            conversation = agent.create_conversation()
            response = conversation.send_message(full_agent_prompt)
            log_task(task_id, f"Antigravity SDK Response: {response.text}")
            agent_success = True
        except Exception as sdk_err:
            log_task(task_id, f"Python SDK execution failed or not available ({sdk_err}). Falling back to 'antigravity' CLI...")
            
            try:
                prompt_file = f"/tmp/prompt_{task_id}.txt"
                with open(prompt_file, "w", encoding="utf-8") as pf:
                    pf.write(full_agent_prompt)

                run_cmd(["antigravity", "run", "--path", workspace_dir, "--prompt-file", prompt_file], env=env, task_id=task_id)
                agent_success = True
                
                if os.path.exists(prompt_file):
                    os.remove(prompt_file)
            except Exception as cli_err:
                log_task(task_id, f"Antigravity CLI execution failed: {cli_err}")
                tasks_db[task_id]["status"] = "failed"
                if notify_number:
                    send_whatsapp_message(notify_number, f"❌ Task {task_id[:8]} failed: Antigravity CLI call failed: {cli_err}")
                return

        # 6. Commit and Push changes
        if agent_success:
            log_task(task_id, "Checking git status for modifications...")
            status_out, _ = run_cmd(["git", "status", "--porcelain"], cwd=workspace_dir, task_id=task_id)
            
            if not status_out.strip():
                log_task(task_id, "WARNING: No changes detected. Antigravity Agent did not modify any files.")
                tasks_db[task_id]["status"] = "completed"
                tasks_db[task_id]["message"] = "Completed. No changes to commit."
                if notify_number:
                    send_whatsapp_message(notify_number, f"⚠️ Task {task_id[:8]} finished but no changes were detected in the repo.")
                return

            log_task(task_id, "Changes detected. Staging changes...")
            run_cmd(["git", "add", "."], cwd=workspace_dir, task_id=task_id)
            
            commit_msg = f"chore: Antigravity AI implemented requested task\n\nTask ID: {task_id}\nPrompt: {req.instruction}"
            run_cmd(["git", "commit", "-m", commit_msg], cwd=workspace_dir, task_id=task_id)
            
            log_task(task_id, f"Pushing changes to remote branch {branch_name}...")
            run_cmd(["git", "push", "origin", branch_name], cwd=workspace_dir, env=env, task_id=task_id)

            # 7. Create Pull Request via GitHub REST API
            log_task(task_id, "Creating GitHub Pull Request...")
            
            try:
                default_branch_out, _ = run_cmd(
                    ["git", "symbolic-ref", "refs/remotes/origin/HEAD"],
                    cwd=workspace_dir,
                    task_id=task_id
                )
                default_branch = default_branch_out.strip().split("/")[-1]
            except Exception:
                default_branch = "main"
                
            log_task(task_id, f"Targeting base branch: {default_branch}")

            pr_title = f"Antigravity: Task {task_id[:8]}"
            pr_body = (
                f"This PR was automatically created by the **Antigravity Home Assistant App**.\n\n"
                f"### User Request:\n> {req.instruction}\n\n"
                f"### Enhanced AI Prompt:\n```markdown\n{enhanced_prompt}\n```"
            )

            pr_payload = {
                "title": pr_title,
                "body": pr_body,
                "head": branch_name,
                "base": default_branch
            }

            headers = {
                "Authorization": f"token {gh_token}",
                "Accept": "application/vnd.github.v3+json"
            }

            pr_api_url = f"https://api.github.com/repos/{owner}/{repo_name}/pulls"
            response = requests.post(pr_api_url, json=pr_payload, headers=headers)
            
            if response.status_code == 201:
                pr_data = response.json()
                pr_url = pr_data.get("html_url")
                tasks_db[task_id]["pr_url"] = pr_url
                tasks_db[task_id]["status"] = "completed"
                tasks_db[task_id]["message"] = "Successfully implemented task and submitted Pull Request."
                log_task(task_id, f"✅ PULL REQUEST CREATED SUCCESSFULLY: {pr_url}")
                if notify_number:
                    send_whatsapp_message(notify_number, f"✅ Task {task_id[:8]} completed!\nPull Request: {pr_url}")
            else:
                log_task(task_id, f"ERROR: Failed to create PR. Status Code: {response.status_code}")
                tasks_db[task_id]["status"] = "failed"
                tasks_db[task_id]["message"] = f"Pushed branch successfully, but failed to create PR: {response.text}"
                if notify_number:
                    send_whatsapp_message(notify_number, f"⚠️ Task {task_id[:8]} pushed to branch {branch_name}, but PR creation failed.")

    except Exception as e:
        tasks_db[task_id]["status"] = "failed"
        tasks_db[task_id]["message"] = f"Workflow failed with exception: {str(e)}"
        log_task(task_id, f"CRITICAL WORKFLOW EXCEPTION: {e}")
        if notify_number:
            send_whatsapp_message(notify_number, f"❌ Task {task_id[:8]} failed with exception: {e}")

    finally:
        try:
            if os.path.exists(workspace_dir):
                shutil.rmtree(workspace_dir)
                log_task(task_id, "Cleaned up workspace directory.")
        except Exception as cleanup_err:
            log_task(task_id, f"Warning: Failed to clean up workspace: {cleanup_err}")

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "antigravity-agent"}

@app.post("/api/task", response_model=TaskStatusResponse)
def trigger_task(req: TaskRequest, background_tasks: BackgroundTasks):
    task_id = str(uuid.uuid4())
    
    tasks_db[task_id] = {
        "status": "pending",
        "message": "Task queued.",
        "repository": req.repository,
        "branch": req.branch or "pending",
        "pr_url": None,
        "logs": []
    }

    background_tasks.add_task(execute_agent_workflow, task_id, req)
    
    return TaskStatusResponse(
        task_id=task_id,
        status="pending",
        message="Workflow initialized in background.",
        repository=req.repository,
        branch=req.branch or "pending"
    )

@app.get("/api/tasks")
def list_tasks():
    return {tid: {k: v for k, v in tdata.items() if k != "logs"} for tid, tdata in tasks_db.items()}

@app.get("/api/tasks/{task_id}")
def get_task(task_id: str):
    if task_id not in tasks_db:
        raise HTTPException(status_code=404, detail="Task not found")
    tdata = tasks_db[task_id]
    return {
        "task_id": task_id,
        "status": tdata["status"],
        "message": tdata["message"],
        "repository": tdata["repository"],
        "branch": tdata["branch"],
        "pr_url": tdata["pr_url"]
    }

@app.get("/api/tasks/{task_id}/logs")
def get_task_logs(task_id: str):
    if task_id not in tasks_db:
        raise HTTPException(status_code=404, detail="Task not found")
    
    log_file = f"/data/tasks/{task_id}.log"
    if os.path.exists(log_file):
        with open(log_file, "r", encoding="utf-8") as f:
            return {"logs": f.read().splitlines()}
            
    return {"logs": tasks_db[task_id]["logs"]}

@app.post("/webhook/whatsapp")
async def whatsapp_webhook(request: Request, background_tasks: BackgroundTasks):
    if os.environ.get("WHATSAPP_ENABLED", "false").lower() != "true":
        return {"status": "ignored", "reason": "whatsapp_disabled"}

    try:
        body = await request.json()
        logger.info(f"Received WhatsApp webhook event: {body}")
        
        data = body.get("data", body)
        key = data.get("key", {})
        sender_jid = key.get("remoteJid", "")
        message_obj = data.get("message", {})
        
        if not sender_jid or not message_obj:
            return {"status": "ignored", "reason": "no_sender_or_message"}
            
        sender_number = sender_jid.split("@")[0]
        
        text = ""
        if "conversation" in message_obj:
            text = message_obj["conversation"]
        elif "extendedTextMessage" in message_obj:
            text = message_obj.get("extendedTextMessage", {}).get("text", "")
            
        if not text:
            return {"status": "ignored", "reason": "no_text_content"}
            
        text_lower = text.lower().strip()
        if text_lower.startswith("antigravity") or text_lower.startswith("!antigravity"):
            cmd_body = text
            if text_lower.startswith("!antigravity"):
                cmd_body = text[12:].strip()
            elif text_lower.startswith("antigravity"):
                cmd_body = text[11:].strip()
                if cmd_body.startswith(":"):
                    cmd_body = cmd_body[1:].strip()
            
            github_url_match = re.search(r"https://github\.com/[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+(?:\.git)?", cmd_body)
            if not github_url_match:
                send_whatsapp_message(
                    sender_number,
                    "⚠️ Could not find a valid GitHub repository URL in your request.\n"
                    "Usage: `antigravity: [instruction] https://github.com/owner/repo`"
                )
                return {"status": "ignored", "reason": "no_github_url"}
                
            repo_url = github_url_match.group(0)
            instruction = cmd_body.replace(repo_url, "").strip()
            
            if not instruction:
                send_whatsapp_message(
                    sender_number,
                    "⚠️ Please specify an instruction describing what feature/fix to implement.\n"
                    "Usage: `antigravity: [instruction] [github_url]`"
                )
                return {"status": "ignored", "reason": "no_instruction"}
                
            task_id = str(uuid.uuid4())
            tasks_db[task_id] = {
                "status": "pending",
                "message": "Task queued via WhatsApp.",
                "repository": repo_url,
                "branch": "pending",
                "pr_url": None,
                "logs": []
            }
            
            send_whatsapp_message(
                sender_number,
                f"🚀 Coding task queued! ID: {task_id[:8]}\n"
                f"Repo: {repo_url}\n"
                f"Instruction: {instruction}"
            )
            
            req = TaskRequest(repository=repo_url, instruction=instruction)
            background_tasks.add_task(execute_agent_workflow, task_id, req, sender_number)
            
            return {"status": "ok", "task_id": task_id}
            
    except Exception as e:
        logger.error(f"Error handling WhatsApp webhook: {e}")
        return {"status": "error", "message": str(e)}

    return {"status": "ignored", "reason": "not_a_command"}
