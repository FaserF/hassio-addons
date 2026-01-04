module.exports = async ({ github, context, core }) => {
  const { data: comments } = await github.rest.issues.listComments({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
  });

  const signature = '<!-- workflow-lint-report -->';
  const previousComments = comments.filter(
    (c) => c.user.type === 'Bot' && c.body.includes(signature)
  );

  // Minimize old lint reports
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

  let body = signature + '\n';
  body += '## 🔧 Workflow Lint Errors\n\n';

  // Strip ANSI color codes from output to ensure regex matching works
  // eslint-disable-next-line no-control-regex
  const output = (process.env.ACTIONLINT_OUTPUT || '').trim().replace(/\x1b\[[0-9;]*m/g, '');
  const stderr = (process.env.ACTIONLINT_STDERR || '').trim();
  const workflowRunUrl = `https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;

  // Robust parsing of actionlint output
  // Format 1: "file:line:col: message [rule]"
  // Format 2: "file:line:col: shellcheck reported issue in this script: SC####:severity:scriptLine:scriptCol: message"
  const errorRegex = /^([^:\n]+):(\d+):(\d+): (.*)$/gm;
  const shellcheckRegex =
    /^([^:\n]+):(\d+):(\d+): shellcheck reported issue in this script: (SC\d+):(\w+):(\d+):(\d+): (.*)$/gm;
  const errors = [];
  const errorsByFile = {};
  let match;

  // First, parse shellcheck format (more specific, needs to come first)
  while ((match = shellcheckRegex.exec(output)) !== null) {
    const [_, file, actionlintLine, actionlintCol, rule, severity, scriptLine, scriptCol, message] =
      match;
    const error = {
      file: file.trim().replace(/^\.\//, ''),
      line: parseInt(actionlintLine), // Use actionlint's line number (where the script block is)
      col: parseInt(actionlintCol),
      message: `[${rule}] ${message.trim()}`,
    };
    errors.push(error);
    if (!errorsByFile[error.file]) errorsByFile[error.file] = [];
    errorsByFile[error.file].push(error);
  }

  // Then parse standard actionlint format (but skip if already captured by shellcheck)
  // Reset regex lastIndex to search from beginning
  errorRegex.lastIndex = 0;
  while ((match = errorRegex.exec(output)) !== null) {
    const [_, file, line, col, message] = match;
    // Skip if this is a shellcheck line (already processed)
    if (message.includes('shellcheck reported issue')) {
      continue;
    }
    const error = {
      file: file.trim().replace(/^\.\//, ''),
      line: parseInt(line),
      col: parseInt(col),
      message: message.trim(),
    };
    errors.push(error);
    if (!errorsByFile[error.file]) errorsByFile[error.file] = [];
    errorsByFile[error.file].push(error);
  }

  const hasZeroIssues = output.includes('Found 0 issues');
  const isEmpty = output === '';
  const hasStderr = stderr && stderr.trim().length > 0;

  // Determine if this is a real error or just a successful run with exit code != 0
  // If actionlint reports "Found 0 issues" and there's no stderr, it likely succeeded
  // even if exit code was non-zero (can happen with some actionlint versions/configs)
  const isLikelySuccess = (hasZeroIssues || (isEmpty && !hasStderr)) && errors.length === 0;
  const isInternalError = !isLikelySuccess && errors.length === 0 && (hasZeroIssues || isEmpty) && hasStderr;

  // --- Generate GitHub Step Summary ---
  if (core && core.summary) {
    core.summary
      .addHeading('🔧 Workflow Lint Results', 2)
      .addRaw(`Found **${errors.length}** issues in **${Object.keys(errorsByFile).length}** files.`)
      .addRaw('\n\n');

    if (errors.length > 0) {
      const rows = [['File', 'Line', 'Issue']];
      for (const err of errors) {
        const isUnpinned = err.message.includes('not pinned to a full length commit SHA');
        const severityIcon = isUnpinned ? 'ℹ️' : '⚠️';
        rows.push([err.file, `L${err.line}`, `${severityIcon} ${err.message}`]);
      }
      core.summary.addTable(rows);
    } else if (isLikelySuccess) {
      core.summary.addRaw('✅ No issues found.');
    } else if (isInternalError) {
      core.summary.addRaw(
        '❌ **Internal Error**: `actionlint` failed but reported 0 issues. Check logs.'
      );
      if (hasStderr) {
        core.summary.addRaw('\n\n**Standard Error Output:**\n```\n' + stderr + '\n```');
      }
    } else if (isEmpty && hasStderr) {
      core.summary.addRaw('❌ **Error**: `actionlint` produced no output but reported errors.\n\n');
      core.summary.addRaw('**Standard Error Output:**\n```\n' + stderr + '\n```');
    } else {
      // Fallback: show raw output if we can't determine the state
      core.summary.addRaw('⚠️ **Unexpected state**: Could not parse actionlint output.\n\n');
      if (output) {
        core.summary.addRaw('**Standard Output:**\n```\n' + output + '\n```\n\n');
      }
      if (hasStderr) {
        core.summary.addRaw('**Standard Error:**\n```\n' + stderr + '\n```');
      }
    }

    await core.summary.write();
  }

  // --- Generate PR Comment ---
  body += '### 🔗 Results\n';
  body += `> 📊 **View Full Report**: [GitHub Step Summary](${workflowRunUrl})\n\n`;

  if (isLikelySuccess) {
    body += '### ✅ Success\n\n';
    body += 'No linting issues were found.\n\n';
  } else if (isInternalError) {
    body += '> [!CAUTION]\n';
    body +=
      '> `actionlint` exited with an error code, but no linting issues were found in stdout.\n\n';
    if (hasStderr) {
      body += '### 🛑 Fatal / Infrastructure Error\n\n';
      body += '```\n';
      body += stderr;
      body += '\n```\n\n';
    } else {
      body +=
        '> This usually means an internal check (like `shellcheck` or `pyflakes`) failed or crashed without outputting to stdout or stderr.\n\n';
    }
    body += `Please check the [live workflow logs](${workflowRunUrl}) for the full execution trace.\n\n`;
  } else if (errors.length === 0 && isEmpty && hasStderr) {
    body += '> [!CAUTION]\n';
    body += '> `actionlint` produced no output but reported errors in stderr.\n\n';
    body += '### 🛑 Fatal / Infrastructure Error\n\n';
    body += '```\n';
    body += stderr;
    body += '\n```\n\n';
    body += `Please check the [live workflow logs](${workflowRunUrl}) for the full execution trace.\n\n`;
  } else if (errors.length === 0 && !isEmpty) {
    // If we have output but it didn't match our regex, show raw output
    body += '### ⚠️ Raw actionlint Output\n\n';
    body += 'The tool produced output that could not be parsed into a table:\n\n';
    body += '```\n';
    body += output;
    if (hasStderr) {
      body += '\n\n--- Standard Error ---\n';
      body += stderr;
    }
    body += '\n```\n\n';
    body += `> 💡 **Tip**: Check the [live workflow logs](${workflowRunUrl}) for more context.\n\n`;
  } else {
    // Normal Error Reporting
    if (stderr) {
      body +=
        '<details>\n<summary>⚠️ <strong>Infrastructure Warnings (stderr)</strong></summary>\n\n';
      body += '```\n' + stderr + '\n```\n\n';
      body += '</details>\n\n';
    }

    body += `Found **${errors.length}** issues in **${Object.keys(errorsByFile).length}** files:\n\n`;

    // Error table with clickable links
    body += '| File | Line | Issue |\n|---|---|---|\n';
    for (const err of errors.slice(0, 20)) {
      // Limit to 20 to avoid huge comments
      const isUnpinned = err.message.includes('not pinned to a full length commit SHA');
      const severityIcon = isUnpinned ? 'ℹ️' : '⚠️';
      const shortMsg = err.message.length > 80 ? err.message.substring(0, 77) + '...' : err.message;
      const fileLink = `https://github.com/${context.repo.owner}/${context.repo.repo}/blob/${context.sha}/${err.file}`;
      body += `| [${err.file}](${fileLink}) | L${err.line} | ${severityIcon} ${shortMsg} |\n`;
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
  }
  body += '<details open>\n<summary>🤖 <strong>AI Fix Instructions</strong></summary>\n\n';
  body += '> **Instructions for AI**: Fix all workflow lint errors below.\n\n';
  body += '```yaml\n';
  body += '# Workflow Lint Errors for AI Processing\n';
  body += 'error_source: actionlint\n';
  body += 'files_to_fix: .github/workflows/*.yaml\n\n';
  body += 'common_fixes:\n';
  body += '  syntax_errors:\n';
  body += '    - Check YAML indentation (2 spaces)\n';
  body += '    - Ensure proper quoting of strings with special chars\n';
  body += '  action_errors:\n';
  body += '    - Verify action versions exist (e.g., actions/checkout@v4)\n';
  body += '    - Update deprecated actions to latest versions\n';
  body += '  expression_errors:\n';
  body += '    - Check ${{ }} syntax and available contexts\n';
  body += '    - Use toJSON() for complex objects\n';
  body += '  shell_errors:\n';
  body += '    - Set shell: bash explicitly for scripts\n';
  body += '    - Use proper exit codes\n';
  body += '\nvalidation_command: actionlint .github/workflows/\n';
  body += '```\n';
  body += '\n</details>\n\n';
  body += '📚 [actionlint documentation](https://github.com/rhysd/actionlint)\n';

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

  // Set output to indicate if this is a real error that should fail the workflow
  // Only fail if there are actual linting errors, not if actionlint just had a non-zero exit code
  // but reported 0 issues (which can happen with some versions/configurations)
  const shouldFail = errors.length > 0 || isInternalError || (isEmpty && hasStderr);
  if (core) {
    core.setOutput('has-errors', shouldFail ? 'true' : 'false');
    core.setOutput('error-count', errors.length.toString());
  }
};
