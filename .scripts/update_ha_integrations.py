import requests
import re
import os

GITHUB_USER = "FaserF"
README_PATH = "README.md"
RE_START = r"<!-- START_HA_INTEGRATIONS -->"
RE_END = r"<!-- END_HA_INTEGRATIONS -->"

def fetch_repos(user):
    url = f"https://api.github.com/users/{user}/repos?per_page=100"
    headers = {}
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"token {token}"
    
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    repos = response.json()
    
    # Filter repos starting with 'ha-'
    ha_repos = [r for r in repos if r["name"].startswith("ha-") and not r["fork"]]
    # Sort by name
    ha_repos.sort(key=lambda x: x["name"])
    return ha_repos

def generate_content(repos):
    content = "## 🧩 Other Home Assistant Integrations\n\n"
    content += "In addition to my apps, I also maintain several other Home Assistant integrations that you might find useful. Here is an overview of my other projects:\n"
    
    if not repos:
        content += "\n*No integrations found (yet!).*\n"
        return content
    
    table = "\n| Integration | Description | Created | Status |\n"
    table += "| :--- | :--- | :--- | :--- |\n"
    
    for repo in repos:
        # User fix: NintendoSwitchCFW was misspelled in repo name or title logic?
        # Actually repo name is ha-NintendoSwitchCFW. 
        # The script title-cases and replaces hyphens.
        name = repo["name"].replace("ha-", "").replace("-", " ").title()
        # Edge case for NintendoSwitchCFW (user corrected it in README)
        if repo["name"] == "ha-NintendoSwitchCFW":
            name = "NintendoSwitchCFW"
            
        url = repo["html_url"]
        desc = repo["description"] or "No description provided."
        created = repo["created_at"][:7] # YYYY-MM
        status = "❌" if repo["archived"] else "✅"
        
        table += f"| **[{name}]({url})** | {desc} | {created} | {status} |\n"
    
    legend = "\n> **Status Legend:**\n"
    legend += "> - ✅ = Maintained (Active development or stable)\n"
    legend += "> - ❌ = Archived (No longer maintained, read-only repository)\n"
    
    return f"\n{content}{table}{legend}\n"

def update_readme(table):
    with open(README_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    
    pattern = re.compile(f"{RE_START}.*?{RE_END}", re.DOTALL)
    new_content = pattern.sub(f"{RE_START}{table}{RE_END}", content)
    
    with open(README_PATH, "w", encoding="utf-8") as f:
        f.write(new_content)

if __name__ == "__main__":
    try:
        print(f"Fetching repos for {GITHUB_USER}...")
        repos = fetch_repos(GITHUB_USER)
        print(f"Found {len(repos)} ha-* repos.")
        content = generate_content(repos)
        print("Updating README.md...")
        update_readme(content)
        print("Done!")
    except Exception as e:
        print(f"Error: {e}")
        exit(1)
