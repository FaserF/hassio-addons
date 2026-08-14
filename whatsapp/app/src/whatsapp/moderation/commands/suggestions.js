/**
 * Calculates Levenshtein distance between two strings.
 */
export function levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

/**
 * Finds similar command suggestions for a given unknown command string.
 */
export function findCommandSuggestions(unknownCmd, availableCmds, maxSuggestions = 3) {
  if (!unknownCmd) return [];
  const target = unknownCmd.toLowerCase();
  const scored = [];

  for (const cmd of availableCmds) {
    const candidate = cmd.toLowerCase();
    // Substring match gets priority score
    if (candidate.startsWith(target) || target.startsWith(candidate)) {
      scored.push({ cmd, dist: 0 });
      continue;
    }
    const dist = levenshteinDistance(target, candidate);
    // Allow distance threshold up to 3 or half the length of target
    const maxAllowed = Math.max(2, Math.floor(target.length / 2));
    if (dist <= maxAllowed) {
      scored.push({ cmd, dist });
    }
  }

  // Sort by distance, deduplicate, and limit to maxSuggestions
  const unique = [];
  const seen = new Set();
  scored
    .sort((a, b) => a.dist - b.dist)
    .forEach((item) => {
      if (!seen.has(item.cmd)) {
        seen.add(item.cmd);
        unique.push(item.cmd);
      }
    });

  return unique.slice(0, maxSuggestions);
}
