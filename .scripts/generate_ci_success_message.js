module.exports = ({
    skipped,
    buildStatus,
    autoMergeNote,
    previousErrorsNote
}) => {
    let body = "## ✅ Verification Successful\n\n";
    body += "Thank you for your contribution!\n\n";
    body += "- 🛡️ **Platinum Standards**: Compliant\n";
    body += "- 🟢 **CI Checks**: " + (skipped ? "⏭️ Skipped" : "Passed") + "\n";
    body += "- 🏗️ **Build**: " + buildStatus + "\n\n";
    body += "This PR meets high quality standards and is ready for review.";

    if (previousErrorsNote) {
        body += previousErrorsNote;
    }

    if (autoMergeNote) {
        body += autoMergeNote;
    }

    return body;
};
