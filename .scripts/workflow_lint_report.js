module.exports = async ({ github, context, core }) => {
  const rawOutput = process.env.ACTIONLINT_OUTPUT || '';

  // Parse actionlint output into structured errors
  const errors = [];
  const errorRegex = /Error:\s+([^:]+):(\d+):(\d+):\s+(.+)/g;
  let match;
  while ((match = errorRegex.exec(rawOutput)) !== null) {
    errors.push({
      file: match[1],
      line: parseInt(match[2]),
      col: parseInt(match[3]),
      message: match[4].trim(),
    });
  }

  // Group errors by file
  const errorsByFile = {};
  for (const err of errors) {
    if (!errorsByFile[err.file]) {
      errorsByFile[err.file] = [];
    }
    errorsByFile[err.file].push(err);
  }

  // Categorize errors
  const categories = {
    shellcheck: [],
    syntax: [],
    action: [],
    expression: [],
    other: [],
  };

  for (const err of errors) {
    if (err.message.includes('shellcheck')) {
      categories.shellcheck.push(err);
    } else if (
      err.message.includes('syntax') ||
      err.message.includes('unexpected')
    ) {
      categories.syntax.push(err);
    } else if (
      err.message.includes('action') ||
      err.message.includes('uses:')
    ) {
      categories.action.push(err);
    } else if (
      err.message.includes('${{') ||
      err.message.includes('expression')
    ) {
      categories.expression.push(err);
    } else {
      categories.other.push(err);
    }
  }

  // Minimize old comments
  const { data: comments } = await github.rest.issues.listComments({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
  });

  const signature = '<!-- workflow-lint-report -->';
  const previousComments = comments.filter(
    (c) => c.user.type === 'Bot' && c.body.includes(signature)
  );

  for (const comment of previousComments) {
    try {
      await github.graphql(
        `
        mutation($subjectId: ID!) {
          minimizeComment(input: {subjectId: $subjectId, classifier: OUTDATED}) {
            minimizedComment { isMinimized }
          }
        }
      `,
        { subjectId: comment.node_id }
      );
    } catch (e) {
      console.log('Could not minimize:', e.message);
    }
  }

  // Build workflow run URL
  const workflowRunUrl = `https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;

  // Build report
  let body = signature + '\n';
  body += '## 🔧 Workflow Lint Errors\n\n';
  body += `> ⚠️ **Note**: Always verify by checking the [live workflow logs](${workflowRunUrl}).\n\n`;
  body += `Found **${errors.length}** issues in **${Object.keys(errorsByFile).length}** files:\n\n`;

  // Error table with clickable links
  body += '| File | Line | Issue |\n|---|---|---|\n';
  for (const err of errors.slice(0, 20)) {
    // Limit to 20 to avoid huge comments
    const fileLink = `[${err.file}](https://github.com/${context.repo.owner}/${context.repo.repo}/blob/${context.sha}/${err.file}#L${err.line})`;
    const shortMsg =
      err.message.length > 80
        ? err.message.substring(0, 77) + '...'
        : err.message;
    body += `| ${fileLink} | L${err.line} | ${shortMsg} |\n`;
  }
  if (errors.length > 20) {
    body += `\n*...and ${errors.length - 20} more errors. See workflow logs for complete list.*\n`;
  }
  body += '\n';

  // Detailed errors by file (collapsed)
  body += '<details>\n<summary>📋 <strong>Detailed Error List</strong></summary>\n\n';
  for (const [file, fileErrors] of Object.entries(errorsByFile)) {
    const fileLink = `https://github.com/${context.repo.owner}/${context.repo.repo}/blob/${context.sha}/${file}`;
    body += `### [${file}](${fileLink})\n\n`;
    for (const err of fileErrors) {
      body += `- **L${err.line}:${err.col}**: ${err.message}\n`;
    }
    body += '\n';
  }
  body += '</details>\n\n';

  // AI Fix Instructions
  body += '<details open>\n<summary>🤖 <strong>AI Fix Instructions</strong></summary>\n\n';
  body += '> **Instructions for AI**: Fix all workflow lint errors below.\n\n';
  body += '```yaml\n';
  body += '# Workflow Lint Errors for AI Processing\n';
  body += `workflow_run_id: ${context.runId}\n`;
  body += `total_errors: ${errors.length}\n`;
  body += `files_affected: ${Object.keys(errorsByFile).length}\n\n`;

  // Errors by category with specific fixes
  if (categories.shellcheck.length > 0) {
    body += 'shellcheck_errors:\n';
    body += `  count: ${categories.shellcheck.length}\n`;
    body += '  common_fix: "Double quote variables to prevent globbing"\n';
    body += '  pattern: "$VARIABLE" should be quoted as \\"$VARIABLE\\"\n';
    body += '  errors:\n';
    for (const err of categories.shellcheck.slice(0, 10)) {
      body += `    - file: "${err.file}"\n`;
      body += `      line: ${err.line}\n`;
      body += `      fix: "Add double quotes around variable references"\n`;
    }
    if (categories.shellcheck.length > 10) {
      body += `    # ... and ${categories.shellcheck.length - 10} more\n`;
    }
    body += '\n';
  }

  if (categories.syntax.length > 0) {
    body += 'syntax_errors:\n';
    body += `  count: ${categories.syntax.length}\n`;
    body += '  common_fix: "Check YAML indentation (2 spaces) and proper quoting"\n';
    body += '  errors:\n';
    for (const err of categories.syntax.slice(0, 5)) {
      body += `    - file: "${err.file}"\n`;
      body += `      line: ${err.line}\n`;
      body += `      message: "${err.message.replace(/"/g, '\\"')}"\n`;
    }
    body += '\n';
  }

  if (categories.action.length > 0) {
    body += 'action_errors:\n';
    body += `  count: ${categories.action.length}\n`;
    body += '  common_fix: "Verify action versions exist and update deprecated ones"\n';
    body += '  errors:\n';
    for (const err of categories.action.slice(0, 5)) {
      body += `    - file: "${err.file}"\n`;
      body += `      line: ${err.line}\n`;
      body += `      message: "${err.message.replace(/"/g, '\\"')}"\n`;
    }
    body += '\n';
  }

  if (categories.expression.length > 0) {
    body += 'expression_errors:\n';
    body += `  count: ${categories.expression.length}\n`;
    body += '  common_fix: "Check ${{ }} syntax and available contexts"\n';
    body += '  errors:\n';
    for (const err of categories.expression.slice(0, 5)) {
      body += `    - file: "${err.file}"\n`;
      body += `      line: ${err.line}\n`;
      body += `      message: "${err.message.replace(/"/g, '\\"')}"\n`;
    }
    body += '\n';
  }

  if (categories.other.length > 0) {
    body += 'other_errors:\n';
    body += `  count: ${categories.other.length}\n`;
    body += '  errors:\n';
    for (const err of categories.other.slice(0, 5)) {
      body += `    - file: "${err.file}"\n`;
      body += `      line: ${err.line}\n`;
      body += `      message: "${err.message.replace(/"/g, '\\"')}"\n`;
    }
    body += '\n';
  }

  // Quick fix summary
  body += '# Quick fix commands:\n';
  body += 'files_to_edit:\n';
  for (const file of Object.keys(errorsByFile)) {
    body += `  - "${file}"\n`;
  }
  body += '\nvalidation_command: actionlint .github/workflows/\n';
  body += '```\n';
  body += '\n</details>\n\n';
  body +=
    '📚 [actionlint documentation](https://github.com/rhysd/actionlint)\n';

  await github.rest.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
    body: body,
  });

  // Add label
  const { data: currentLabels } = await github.rest.issues.listLabelsOnIssue({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
  });

  if (!currentLabels.some((l) => l.name === 'workflow/lint-error')) {
    await github.rest.issues.addLabels({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.issue.number,
      labels: ['workflow/lint-error'],
    });
  }
};
