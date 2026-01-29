#!/bin/bash
# minimize-comments.sh
# Usage: ./minimize-comments.sh <PR_NUMBER> <MATCH_STRING>

PR_NUMBER=$1
MATCH_STRING=$2

if [ -z "$PR_NUMBER" ] || [ -z "$MATCH_STRING" ]; then
  echo "Usage: $0 <PR_NUMBER> <MATCH_STRING>"
  exit 1
fi

echo "Minimizing comments on PR #$PR_NUMBER matching '$MATCH_STRING'..."

# Get the current user/bot login
CURRENT_USER=$(gh api user --jq .login)
echo "Current user: $CURRENT_USER"

# GraphQL query to find comments
# We need the node ID to minimize
QUERY_FIND="
query {
  repository(owner: \"${GITHUB_REPOSITORY%/*}\", name: \"${GITHUB_REPOSITORY#*/}\") {
    pullRequest(number: $PR_NUMBER) {
      comments(last: 100) {
        nodes {
          id
          body
          author {
            login
          }
          isMinimized
        }
      }
    }
  }
}
"

# Fetch comments
RESPONSE=$(gh api graphql -f query="$QUERY_FIND")

# Process comments using jq to filter
# select: author matches current user/bot (handling github-actions[bot] vs github-actions)
# select: body contains match string
# select: isMinimized is false (don't process already minimized ones)
COMMENTS_TO_MINIMIZE=$(echo "$RESPONSE" | jq -r --arg MATCH "$MATCH_STRING" --arg USER "$CURRENT_USER" '
  .data.repository.pullRequest.comments.nodes[]
  | select((.author.login == $USER or .author.login == "github-actions" or .author.login == "github-actions[bot]")
           and (.body | contains($MATCH))
           and (.isMinimized == false))
  | .id
')

if [ -z "$COMMENTS_TO_MINIMIZE" ]; then
  echo "No matching active comments found to minimize."
  exit 0
fi

# Minimize each comment
for comment_id in $COMMENTS_TO_MINIMIZE; do
  echo "Minimizing comment $comment_id..."

  QUERY_MINIMIZE="
  mutation {
    minimizeComment(input: {subjectId: \"$comment_id\", classifier: OUTDATED}) {
      minimizeComment {
        isMinimized
      }
    }
  }
  "

  gh api graphql -f query="$QUERY_MINIMIZE" > /dev/null
done

echo "Done."
