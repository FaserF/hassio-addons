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

# Function to generate GraphQL query with cursor
generate_query() {
	local cursor=$1
	local after_clause=""
	if [ -n "$cursor" ]; then
		after_clause="after: \"$cursor\","
	fi

	cat <<EOF
query {
  repository(owner: "${GITHUB_REPOSITORY%/*}", name: "${GITHUB_REPOSITORY#*/}") {
    pullRequest(number: $PR_NUMBER) {
      comments(first: 50, $after_clause orderBy: {field: CREATED_AT, direction: DESC}) {
        pageInfo {
          hasNextPage
          endCursor
        }
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
EOF
}

# Iterate through all pages of comments
HAS_NEXT_PAGE="true"
CURSOR=""

while [ "$HAS_NEXT_PAGE" = "true" ]; do
	echo "Fetching comments (cursor: ${CURSOR:-start})..."

	QUERY_FIND=$(generate_query "$CURSOR")
	RESPONSE=$(gh api graphql -f query="$QUERY_FIND")

	# Check for errors in response
	if echo "$RESPONSE" | grep -q "errors"; then
		echo "Error fetching comments:"
		echo "$RESPONSE"
		exit 1
	fi

	# update pagination flags
	HAS_NEXT_PAGE=$(echo "$RESPONSE" | jq -r '.data.repository.pullRequest.comments.pageInfo.hasNextPage')
	CURSOR=$(echo "$RESPONSE" | jq -r '.data.repository.pullRequest.comments.pageInfo.endCursor')

	# Process comments in this batch
	COMMENTS_TO_MINIMIZE=$(echo "$RESPONSE" | jq -r --arg MATCH "$MATCH_STRING" --arg USER "$CURRENT_USER" '
    .data.repository.pullRequest.comments.nodes[]
    | select((.author.login == $USER or .author.login == "github-actions" or .author.login == "github-actions[bot]")
             and (.body | contains($MATCH))
             and (.isMinimized == false))
    | .id
  ')

	if [ -n "$COMMENTS_TO_MINIMIZE" ]; then
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
			gh api graphql -f query="$QUERY_MINIMIZE" >/dev/null
		done
	fi
done

echo "Done."
