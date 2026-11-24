#!/usr/bin/env python3
"""Generates a structured, deduplicated, user-friendly changelog from git commit history."""

import argparse
import re
import subprocess
import sys

# Noise filter — commits matching ANY pattern are silently dropped
NOISE_PATTERNS = [
    r"^\s*$",
    r"^(Update|Aktualisier[et]?|Add|Adds|Adde|Delete|Deletes|Remove|Removes|Rename|Renames|Move|Moves|Fix|Edit|Change|Modify)\s+[\w\-\.\/]+\.\w{1,10}\s*$",
    r"^Merge (pull request|branch|remote-tracking branch)\b",
    r"^Merge from\b",
    r"^(chore|build)(\([^)]*\))?:\s*(bump|release|version)\b",
    r"^(bump|release)(\s+version)?\s+v?\d",
    r"^v?\d+\.\d+\.\d+\s*$",
    r"^\[skip[- ]ci\]",
    r"^chore: regenerate (manifest|connections|changelog)\b",
    r"^(auto.?generated?|automated?|bot:)\b",
    r'^Revert "Revert',
    r"^Initial commit\s*$",
    r"^WIP\b",
    r"^wip\b",
    r"^.{1,3}$",
    r"\[skip[- ]ci\]\s*$",
]

# Category order & display labels
CATEGORY_ORDER = [
    "breaking",
    "feat",
    "fix",
    "security",
    "perf",
    "refactor",
    "ui",
    "docs",
    "test",
    "ci",
    "chore",
    "other",
]
CATEGORY_EMOJI = {
    "breaking": "💥 Breaking Changes",
    "feat": "✨ New Features",
    "fix": "🐛 Bug Fixes",
    "security": "🔒 Security",
    "perf": "⚡ Performance",
    "refactor": "♻️ Code Improvements",
    "ui": "🎨 UI / Translations",
    "docs": "📚 Documentation",
    "test": "🧪 Tests",
    "ci": "🔄 CI / CD",
    "chore": "🔧 Maintenance",
    "other": "📦 Other Changes",
}

# Conventional commit type → bucket mapping
TYPE_MAP = {
    "feat": "feat",
    "feature": "feat",
    "fix": "fix",
    "bugfix": "fix",
    "hotfix": "fix",
    "security": "security",
    "sec": "security",
    "perf": "perf",
    "optim": "perf",
    "refactor": "refactor",
    "refact": "refactor",
    "ui": "ui",
    "style": "ui",
    "ux": "ui",
    "docs": "docs",
    "doc": "docs",
    "test": "test",
    "tests": "test",
    "ci": "ci",
    "cd": "ci",
    "build": "ci",
    "chore": "chore",
    "maint": "chore",
    "deps": "chore",
    "bump": "chore",
    "revert": "fix",
}

# Scope overrides
SCOPE_MAP = {
    "ui": "ui",
    "translation": "ui",
    "translate": "ui",
    "docs": "docs",
    "readme": "docs",
    "test": "test",
    "tests": "test",
    "ci": "ci",
    "workflow": "ci",
    "actions": "ci",
}

MAX_PER_SECTION = 15
NEVER_COLLAPSE = ["breaking", "security"]


def get_norm_key(msg: str) -> str:
    n = msg.lower()
    # Strip conventional commit prefixes
    n = re.sub(
        r"^(feat|fix|docs|style|refactor|perf|test|chore|ci|security|build|ui|ux|revert)(\([^)]*\))?(!)?:\s*",
        "",
        n,
    )
    n = re.sub(r"[\.\!\?\,\;\:\"\'`]", "", n)
    # Strip common prepositions
    n = re.sub(r"\b(the|a|an|for|of|in|to|with|from|on|at|by)\b", "", n)
    # Normalize whitespaces
    n = re.sub(r"\s+", " ", n)
    return n.strip()


def get_formatted_item(
    display: str, hashes: list, repo: str, commit_authors: dict
) -> str:
    if hashes:
        links = []
        attributions = []
        for h in hashes:
            if repo:
                links.append(f"[{h}](https://github.com/{repo}/commit/{h})")
            else:
                links.append(f"`{h}`")
            # Author attribution logic
            author = commit_authors.get(h, "")
            # If author is external (not owner/faserf and not github-actions/dependabot/actions/bot/etc)
            if author:
                author_lower = author.lower()
                is_ignored = (
                    "faserf" in author_lower
                    or "action" in author_lower
                    or "bot" in author_lower
                    or "dependabot" in author_lower
                    or "fabian" in author_lower
                    or "seitz" in author_lower
                )
                if not is_ignored:
                    attributions.append(f"thanks to @{author} for this contribution!")

        hash_str = ", ".join(links)
        attr_str = f" — {', '.join(attributions)}" if attributions else ""
        return f"{display} ({hash_str}){attr_str}"
    return display


def main():
    parser = argparse.ArgumentParser(description="Generate structured git changelog.")
    parser.add_argument("--from-tag", default="", help="Git ref to diff against")
    parser.add_argument("--total-commits", default="", help="Total commit count input")
    parser.add_argument("--repo", default="", help="Repository identifier (owner/name)")
    args = parser.parse_args()

    from_tag = args.from_tag
    total_commits = args.total_commits
    repo = args.repo

    if from_tag:
        git_args = ["git", "log", f"{from_tag}..HEAD", "--pretty=format:%h %an || %s"]
    else:
        git_args = ["git", "log", "--pretty=format:%h %an || %s", "--max-count=2000"]

    try:
        raw_output = subprocess.check_output(
            git_args, stderr=subprocess.DEVNULL
        ).decode("utf-8", errors="ignore")
    except subprocess.CalledProcessError:
        raw_output = ""

    commit_lines = [line.strip() for line in raw_output.splitlines() if line.strip()]
    commit_authors = {}

    try:
        total_raw = int(total_commits) if total_commits else len(commit_lines)
    except ValueError:
        total_raw = len(commit_lines)

    buckets = {k: [] for k in CATEGORY_ORDER}
    seen_items = {}

    for line in commit_lines:
        author = ""
        if " || " in line:
            parts = line.split(" || ", 1)
            meta, msg = parts[0], parts[1].strip()
            meta_parts = meta.split(" ", 1)
            commit_hash = meta_parts[0]
            if len(meta_parts) > 1:
                author = meta_parts[1].strip()
        else:
            match = re.match(r"^([0-9a-fA-F]+)\s+(.*)$", line)
            if match:
                commit_hash = match.group(1)
                msg = match.group(2).strip()
            else:
                commit_hash = ""
                msg = line.strip()

        if commit_hash and author:
            commit_authors[commit_hash] = author

        if not msg:
            continue

        # Skip noise commits
        if any(re.search(p, msg) for p in NOISE_PATTERNS):
            continue

        bucket = "other"
        display = msg
        is_break = False

        conv_match = re.match(
            r"^([A-Za-z][A-Za-z0-9_-]*)(\([^)]*\))?(!)?:\s*(.+)$", msg
        )
        if conv_match:
            raw_type = conv_match.group(1).lower()
            raw_scope = conv_match.group(2)
            raw_scope = (
                re.sub(r"[()]", "", raw_scope).lower().strip() if raw_scope else ""
            )
            is_break = bool(conv_match.group(3))
            desc = conv_match.group(4).strip()

            if raw_scope and raw_scope in SCOPE_MAP:
                bucket = SCOPE_MAP[raw_scope]
            elif raw_type in TYPE_MAP:
                bucket = TYPE_MAP[raw_type]

            desc_cap = desc[0].upper() + desc[1:] if desc else desc
            display = f"**{raw_scope}:** {desc_cap}" if raw_scope else desc_cap
        else:
            display = msg[0].upper() + msg[1:] if msg else msg
            msg_lower = msg.lower()
            if any(
                w in msg_lower
                for w in ["general fix", "small fix", "bug fix", "fixes", "fixed"]
            ) or re.search(r"\bfix(es|ed)?\b", msg_lower):
                bucket = "fix"
            elif any(
                w in msg_lower
                for w in [
                    "ci",
                    "linter",
                    "lint fix",
                    "pipeline",
                    "workflow",
                    "github action",
                    "generate_changelog",
                    "changelog",
                ]
            ):
                bucket = "ci"
            elif any(
                w in msg_lower
                for w in [
                    "update depend",
                    "bump depend",
                    "renovate",
                    "dependency update",
                    "upgrade dep",
                ]
            ):
                bucket = "chore"
            elif any(
                w in msg_lower
                for w in [
                    "add feature",
                    "added feature",
                    "adds feature",
                    "new feature",
                    "add support",
                    "introduce",
                ]
            ) or msg_lower.startswith(("add ", "adds ", "expose ", "exposed ")):
                bucket = "feat"
            elif any(
                w in msg_lower for w in ["security", "vulnerability", "cve", "auth"]
            ):
                bucket = "security"
            elif any(w in msg_lower for w in ["perf", "speed", "faster", "optim"]):
                bucket = "perf"
            elif (
                "refactor" in msg_lower
                or "cleanup" in msg_lower
                or "clean up" in msg_lower
                or "improve" in msg_lower
                or msg_lower.startswith(
                    ("filter ", "use ", "remove ", "avoid ", "robust ")
                )
            ):
                bucket = "refactor"
            elif any(w in msg_lower for w in ["doc", "readme", "wiki", "guide"]):
                bucket = "docs"
            elif any(w in msg_lower for w in ["test", "spec", "unit test"]):
                bucket = "test"
            elif any(
                w in msg_lower
                for w in [
                    "ui",
                    "ux",
                    "layout",
                    "style",
                    "theme",
                    "translation",
                    "strings",
                    "lang",
                ]
            ):
                bucket = "ui"

        norm_key = get_norm_key(display)

        if is_break:
            break_display = f"**{display}**"
            break_key = f"breaking:{norm_key}"
            if break_key in seen_items:
                existing_break = seen_items[break_key]
                if commit_hash and commit_hash not in existing_break["hashes"]:
                    existing_break["hashes"].append(commit_hash)
            else:
                break_item = {
                    "display": break_display,
                    "hashes": [commit_hash] if commit_hash else [],
                }
                seen_items[break_key] = break_item
                buckets["breaking"].append(break_item)

        if norm_key in seen_items:
            existing_item = seen_items[norm_key]
            if commit_hash and commit_hash not in existing_item["hashes"]:
                existing_item["hashes"].append(commit_hash)
            continue

        item = {"display": display, "hashes": [commit_hash] if commit_hash else []}
        seen_items[norm_key] = item
        buckets[bucket].append(item)

    out = []
    has_any = False
    filtered_count = sum(len(buckets[k]) for k in CATEGORY_ORDER)

    if buckets["breaking"]:
        has_any = True
        out.append("> [!CAUTION]")
        out.append(
            "> **This release contains breaking changes. Please review before updating.**"
        )
        out.append(">")
        for item in buckets["breaking"]:
            formatted = get_formatted_item(
                item["display"], item["hashes"], repo, commit_authors
            )
            out.append(f"> - {formatted}")
        out.append("")

    for key in CATEGORY_ORDER:
        if key == "breaking":
            continue
        bucket = buckets[key]
        if not bucket:
            continue
        has_any = True

        out.append(f"### {CATEGORY_EMOJI[key]}")
        out.append("")

        collapse = (len(bucket) > MAX_PER_SECTION) and (key not in NEVER_COLLAPSE)

        if collapse:
            for i in range(MAX_PER_SECTION):
                formatted = get_formatted_item(
                    bucket[i]["display"], bucket[i]["hashes"], repo, commit_authors
                )
                out.append(f"- {formatted}")
            remaining = len(bucket) - MAX_PER_SECTION
            out.append("")
            out.append("<details>")
            out.append(f"<summary>Show {remaining} more changes…</summary>")
            out.append("")
            for i in range(MAX_PER_SECTION, len(bucket)):
                formatted = get_formatted_item(
                    bucket[i]["display"], bucket[i]["hashes"], repo, commit_authors
                )
                out.append(f"- {formatted}")
            out.append("")
            out.append("</details>")
        else:
            for item in bucket:
                formatted = get_formatted_item(
                    item["display"], item["hashes"], repo, commit_authors
                )
                out.append(f"- {formatted}")
        out.append("")

    if not has_any:
        out.append("> *No categorised changes found in this release.*")
        out.append(
            "> Most commits were maintenance, dependency updates, or automated changes."
        )
        out.append("")

    range_str = f"{from_tag}..HEAD" if from_tag else "all history"
    out.append("---")

    if total_raw > 0:
        out.append(
            f"*{filtered_count} significant changes from {total_raw} total commits since `{from_tag}`.*"
        )
    else:
        out.append(f"*Changelog generated from `{range_str}`.*")

    sys.stdout.reconfigure(encoding="utf-8")
    print("\n".join(out))


if __name__ == "__main__":
    main()
