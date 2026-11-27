module.exports = ({ skipped, buildStatus, autoMergeNote, previousErrorsNote, isSelfDev = false }) => {
  let body = '## ✅ Verification Successful\n\n';
  if (!isSelfDev) {
    body += 'Thank you for your contribution!\n\n';
  }
  body += '- 🛡️ **Platinum Standards**: Compliant\n';
  body += '- 🟢 **CI Checks**: ' + (skipped ? '⏭️ Skipped' : 'Passed') + '\n';
  body += '- 🏗️ **Build**: ' + buildStatus + '\n';
  if (!isSelfDev) {
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
