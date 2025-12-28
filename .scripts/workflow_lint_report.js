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

  const output = (process.env.ACTIONLINT_OUTPUT || '').trim();
  const hasZeroIssues = output.includes('Found 0 issues');
  const isEmpty = output === '' || output === 'See workflow logs for details.';

  if (hasZeroIssues || isEmpty) {
    body += '> [!WARNING]\n';
    body += '> `actionlint` exited with an error code, but no specific issues were found in the standard output.\n';
    body += '> This usually means an internal check (like `shellcheck` or `pyflakes`) failed or crashed.\n\n';
    body += 'Please check the [workflow logs](' + context.payload.repository.html_url + '/actions/runs/' + context.runId + ') for the raw error messages.\n\n';
  } else {
    body += 'The following issues were found in the workflow files:\n\n';
    body += '```\n';
    body += output;
    body += '\n```\n\n';
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
};
