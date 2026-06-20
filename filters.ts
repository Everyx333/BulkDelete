import { DeleteFilters } from "./types";

/**
 * Check whether a single message passes all the filters the user specified.
 * This is called on every message found during scanning.
 *
 * Returns true if the message should be included in the delete queue,
 * false if it should be skipped.
 *
 * Uses BigInt comparisons for snowflake IDs (before/after) and
 * epoch comparisons for age-based filters (olderThan/newerThan).
 */
export function passesFilters(msg: any, filters: DeleteFilters): boolean {
    const beforeId = filters.before;
    if (beforeId && BigInt(msg.id) >= BigInt(beforeId))
        return false;

    const afterId = filters.after;
    if (afterId && BigInt(msg.id) <= BigInt(afterId))
        return false;

    if (filters.contains) {
        const content = msg.content?.toLowerCase() || "";
        if (!content.includes(filters.contains.toLowerCase()))
            return false;
    }

    if (filters.hasAttachments && (!msg.attachments || msg.attachments.length === 0))
        return false;

    if (filters.hasEmbeds && (!msg.embeds || msg.embeds.length === 0))
        return false;

    if (filters.hasLinks) {
        const hasLink = /https?:\/\/[^\s]+/i.test(msg.content || "");
        if (!hasLink) return false;
    }

    if (filters.olderThan) {
        const age = Date.now() - new Date(msg.timestamp).getTime();
        if (age < filters.olderThan * 24 * 60 * 60 * 1000)
            return false;
    }

    if (filters.newerThan) {
        const age = Date.now() - new Date(msg.timestamp).getTime();
        if (age > filters.newerThan * 24 * 60 * 60 * 1000)
            return false;
    }

    return true;
}
