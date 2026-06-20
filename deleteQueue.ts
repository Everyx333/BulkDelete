import { DeleteStats } from "./types";

/**
 * Iterate over the message queue and delete each one using the
 * provided deleter function.
 *
 * This is a generic processor — it doesn't care HOW messages are deleted,
 * only that each one gets passed to the deleter callback. The rate limiter
 * and anti-log logic live in rateLimiter.ts, not here.
 *
 * @param queue - Array of messages to delete
 * @param deleter - Async function that deletes a single message, returns true on success
 * @param progress - Optional callback fired after each deletion (deleted count, total)
 */
export async function deleteQueue(
    queue: any[],
    deleter: (message: any) => Promise<boolean>,
    progress?: (deleted: number, total: number) => void
): Promise<DeleteStats> {

    const startedAt = Date.now();

    let deleted = 0;
    let failed = 0;

    for (const msg of queue) {
        try {
            const ok = await deleter(msg);

            if (ok)
                deleted++;
            else
                failed++;
        } catch {
            failed++;
        }

        progress?.(deleted, queue.length);
    }

    return {
        deleted,
        failed,
        scanned: queue.length,
        skipped: 0,
        startedAt,
        finishedAt: Date.now()
    };
}
