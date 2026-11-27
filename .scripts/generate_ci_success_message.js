module.exports = ({
  skipped,
  buildStatus,
  autoMergeNote,
  previousErrorsNote,
  isSelfDev = false,
  isCompact = false,
}) => {
  const compact = Boolean(isCompact || isSelfDev);
  let body = '## ✅ Verification Successful\n\n';
  if (!compact) {
    body += 'Thank you for your contribution!\n\n';
  }
  body += '- 🛡️ **Platinum Standards**: Compliant\n';
  body += '- 🟢 **CI Checks**: ' + (skipped ? '⏭️ Skipped' : 'Passed') + '\n';
  body += '- 🏗️ **Build**: ' + buildStatus + '\n';
  if (!compact) {
    body += '\nThis PR meets high quality standards and is ready for review.';
  }

  if (previousErrorsNote) {
    body += previousErrorsNote;
  }

  if (autoMergeNote) {
    body += autoMergeNote;
  }

  return body;
};
