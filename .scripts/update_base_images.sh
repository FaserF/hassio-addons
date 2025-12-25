#!/bin/bash
# shellcheck disable=SC2034,SC2129,SC2016
set -e

echo "Starting version increment process..."
echo "Finding and processing config.yaml files..."
find . -name 'config.yaml' -print0 |
	while IFS= read -r -d '' configfile; do
		echo "--------------------------------------------"
		echo "Processing: $configfile"
		# Normalize path
		clean_configfile="${configfile#./}"

		# Check if modified in last commit (trigger condition)
		# Only if running on push event? No, we want to run if build.yaml changed.
		# The original workflow checked for build.yaml changes via paths filter.
		# Here we should verify if we need to bump.
		# Strategy: Check if build.yaml sibling has changed effectively?
		# Or just blindly bump if triggered?
		# Original logic: "if git diff ... grep configfile ... skipping".
		# It assumes we are reacting to *other* changes.

		# Simpler logic for Orchestrator:
		# If build.yaml in this dir changed, bump config.yaml.
		dir=$(dirname "$configfile")
		# Robust check for changes (handle shallow clones)
		if git rev-parse --verify HEAD~1 >/dev/null 2>&1; then
			changed_files=$(git diff --name-only HEAD~1 HEAD)
		else
			# Fallback for initial/shallow commits: check all files
			changed_files=$(git ls-tree -r --name-only HEAD)
		fi

		if echo "$changed_files" | grep -F -q "$dir/build.yaml"; then
			echo "Build.yaml changed in $dir. Bumping version..."

			# ... Version Bump Logic (Major.Minor.Patch) ...
			OLD_VERSION=$(grep -E '^[[:space:]]*version:[[:space:]]+[0-9]+\.[0-9]+\.[0-9]+' "$configfile" | head -1 | awk '{print $2}' | tr -d '"')

            # Validate Version Format
            if [[ ! "$OLD_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                echo "Error: Invalid or missing version in $configfile: '$OLD_VERSION'. Skipping."
                continue
            fi

			IFS='.' read -r major minor patch <<<"$OLD_VERSION"
			patch=$((patch + 1))
			NEW_VERSION="$major.$minor.$patch"

			echo "Bumping $OLD_VERSION -> $NEW_VERSION"
			sed -i "s/^version: .*/version: \"$NEW_VERSION\"/" "$configfile"

			# Changelog Update
			if [ -f "$dir/CHANGELOG.md" ]; then
				sed -i "/# Changelog/a \\\\n## $NEW_VERSION\\n- Update base image\\n" "$dir/CHANGELOG.md"
			fi
		else
			echo "No build.yaml change for $dir. Skipping."
		fi
	done
