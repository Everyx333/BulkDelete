/**
 * Wait for a given number of milliseconds.
 * Used to add delays between API calls to avoid rate limits.
 */
export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Convert a millisecond duration into a human-readable string.
 * Examples: "342ms", "2.3s", "1.5m"
 */
export function formatTime(ms: number) {
    if (ms < 1000)
        return `${ms}ms`;

    if (ms < 60000)
        return `${(ms / 1000).toFixed(1)}s`;

    return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Pluralize a word based on count.
 * Examples: plural(1, "message") -> "1 message", plural(3, "day") -> "3 days"
 */
export function plural(count: number, word: string) {
    return `${count} ${word}${count === 1 ? "" : "s"}`;
}
