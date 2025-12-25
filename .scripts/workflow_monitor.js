module.exports = async ({ github, context, core }) => {
  const workflowRun = context.payload.workflow_run;
  let prNumber = workflowRun.pull_requests[0]?.number;

  if (!prNumber) {
    console.log("No PR in payload, searching by SHA...");
    const { data: pullRequests } = await github.rest.repos.listPullRequestsAssociatedWithCommit({
      owner: context.repo.owner,
      repo: context.repo.repo,
      commit_sha: workflowRun.head_sha,
    });
    if (pullRequests.length > 0) {
      prNumber = pullRequests[0].number;
      console.log(`Found PR #${prNumber} associated with commit ${workflowRun.head_sha}`);
    }
  }

  if (!prNumber) {
    console.log("No PR associated with this workflow run.");
    return;
  }

  // Get jobs for the failed workflow run
  const { data: jobs } = await github.rest.actions.listJobsForWorkflowRun({
    owner: context.repo.owner,
    repo: context.repo.repo,
    run_id: workflowRun.id,
  });

  const failedJobs = jobs.jobs.filter(j => j.conclusion === 'failure');

  // Infrastructure error patterns (not project test failures)
  const infraPatterns = [
    { pattern: /action.*not found/i, type: "Action Not Found", fix: "Update action to an existing version" },
    { pattern: /version.*deprecated/i, type: "Deprecated Version", fix: "Update to a supported version" },
    { pattern: /runner.*unavailable/i, type: "Runner Unavailable", fix: "Check runner labels and availability" },
    { pattern: /timeout/i, type: "Timeout", fix: "Increase timeout or optimize the step" },
    { pattern: /rate limit/i, type: "Rate Limit", fix: "Wait and retry, or reduce API calls" },
    { pattern: /yaml.*error|syntax error/i, type: "YAML/Syntax Error", fix: "Run actionlint locally to fix syntax" },
    { pattern: /permission denied/i, type: "Permission Error", fix: "Check workflow permissions" },
    { pattern: /node.*version|unsupported.*node/i, type: "Node Version Issue", fix: "Update to Node.js 20" },
    { pattern: /docker.*error|container.*error/i, type: "Docker Error", fix: "Check Dockerfile and build context" },
    { pattern: /cancelled/i, type: "Workflow Cancelled", fix: "Investigate concurrent run conflicts" },
    { pattern: /unauthorized|authentication failed/i, type: "Auth Failure", fix: "Check secrets and permissions" },
    { pattern: /network.*error|connection.*refused/i, type: "Network Error", fix: "Retry or check external service status" },
    { pattern: /disk.*space|no space left/i, type: "Disk Space", fix: "Clean up runner or optimize build artifacts" },
    { pattern: /cache.*error|restore.*fail/i, type: "Cache Error", fix: "Clear cache or check keys" },
  ];

  // Analyze failures
  let infraErrors = [];
  let projectErrors = [];

  for (const job of failedJobs) {
    // GitHub might not include the failed setup step in the steps array if it happened during "Set up job"
    const failedStep = job.steps?.find(s => s.conclusion === 'failure');
    const stepName = failedStep?.name || (job.status === 'completed' ? "Setup/Infrastructure" : "Unknown");

    // Check if this is an infrastructure error
    let isInfraError = false;
    let errorInfo = { job: job.name, step: stepName, type: "Unknown", fix: "Check logs" };

    // Check step name for patterns
    for (const { pattern, type, fix } of infraPatterns) {
      if (pattern.test(stepName) || pattern.test(job.name)) {
        errorInfo.type = type;
        errorInfo.fix = fix;
        isInfraError = true;
        break;
      }
    }

    // Known infrastructure steps
    const infraSteps = [
      'Check out code', 'Set up', 'Setup', 'Install', 'Cache',
      'Download', 'Upload', 'Docker', 'Login', 'Checkout'
    ];
    if (infraSteps.some(s => stepName.includes(s))) {
      isInfraError = true;
      errorInfo.type = "Setup/Infrastructure";
    }

    // Known project test steps (exclude from infra report)
    const testSteps = [
      'ShellCheck', 'Hadolint', 'MarkdownLint', 'YAMLLint', 'Prettier',
      'Add-on Linter', 'Compliance', 'Trivy', 'Build All', 'Test Build'
    ];
    if (testSteps.some(s => stepName.includes(s) || job.name.includes(s))) {
      projectErrors.push(errorInfo);
      continue; // Skip - this is a project test, not infra
    }

    if (isInfraError) {
      infraErrors.push(errorInfo);
    }
  }

  // Only report if there are infrastructure errors
  if (infraErrors.length === 0) {
    console.log("No infrastructure errors detected. Project test failures are handled by CI workflow.");
    return;
  }

  // Create report
  const signature = "<!-- workflow-infra-error -->";
  let body = signature + "\n";
  body += "## 🔧 Workflow Infrastructure Error\n\n";
  body += "An error occurred in the workflow infrastructure (not in project tests).\n\n";
  body += "| Job | Step | Error Type | Fix |\n|---|---|---|---|\n";

  for (const err of infraErrors) {
    body += `| ${err.job} | ${err.step} | ${err.type} | ${err.fix} |\n`;
  }

  body += "\n";
  body += "<details>\n<summary>🤖 <strong>AI Fix Instructions</strong></summary>\n\n";
  body += "> **Instructions for AI**: These are infrastructure errors, not code issues.\n\n";
  body += "```yaml\n";
  body += "# Workflow Infrastructure Errors for AI Processing\n";
  body += "workflow_name: \"" + workflowRun.name + "\"\n";
  body += "run_id: " + workflowRun.id + "\n";
  body += "run_url: \"" + workflowRun.html_url + "\"\n\n";
  body += "infrastructure_errors:\n";
  for (const err of infraErrors) {
    body += `  - job: "${err.job}"\n`;
    body += `    step: "${err.step}"\n`;
    body += `    error_type: "${err.type}"\n`;
    body += `    fix: "${err.fix}"\n`;
  }
  body += "\nnot_auto_fixable:\n";
  body += "  - Most infrastructure errors require maintainer intervention\n";
  body += "  - Check if external services are available\n";
  body += "  - Verify GitHub Actions quotas and permissions\n";
  if (projectErrors.length > 0) {
    body += `\nproject_test_failures: ${projectErrors.length}\n`;
    body += "note: Project test failures are handled by orchestrator-ci.yaml\n";
  }
  body += "```\n";
  body += "\n</details>\n\n";
  body += `🔗 [Workflow Logs](${workflowRun.html_url})\n`;

  // Check for existing comment
  const { data: comments } = await github.rest.issues.listComments({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: prNumber,
  });

  const previousComments = comments.filter(c =>
    c.user.type === 'Bot' && c.body.includes(signature)
  );

  // Minimize old reports
  for (const comment of previousComments) {
    try {
      await github.graphql(`
        mutation($subjectId: ID!) {
          minimizeComment(input: {subjectId: $subjectId, classifier: OUTDATED}) {
            minimizedComment { isMinimized }
          }
        }
      `, { subjectId: comment.node_id });
    } catch (e) { console.log("Could not minimize:", e.message); }
  }

  // Post new report
  await github.rest.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: prNumber,
    body: body
  });

  // Add label
  const { data: currentLabels } = await github.rest.issues.listLabelsOnIssue({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: prNumber,
  });

  if (!currentLabels.some(l => l.name === 'workflow/infra-error')) {
    await github.rest.issues.addLabels({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: prNumber,
      labels: ['workflow/infra-error']
    });
  }
};
