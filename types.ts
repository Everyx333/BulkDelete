/**
 * Filters that decide which messages get deleted.
 * All fields are AND-ed together - a message must match every set filter.
 */
export interface DeleteFilters {
    /** Maximum number of messages to collect and delete */
    amount: number;

    /** Only delete messages sent BEFORE this Discord snowflake ID */
    before?: string;
    /** Only delete messages sent AFTER this Discord snowflake ID */
    after?: string;

    /** Only delete messages whose content contains this text (case-insensitive) */
    contains?: string;

    /** Only delete messages that contain a link */
    hasLinks?: boolean;
    /** Only delete messages that have file attachments */
    hasAttachments?: boolean;
    /** Only delete messages that have embedded content (link previews, etc.) */
    hasEmbeds?: boolean;

    /** Only delete messages older than this many days */
    olderThan?: number;
    /** Only delete messages newer than this many days */
    newerThan?: number;

    /** Include bot messages that were triggered by your slash commands */
    includeBotMessages?: boolean;
}

/**
 * Result returned after scanning messages.
 * The queue is finalized before any deletion happens.
 */
export interface ScanResult {
    /** Messages that matched all filters and are ready to delete */
    queue: any[];
    /** Total messages inspected during scanning */
    scanned: number;
    /** Messages skipped (not yours, or didn't pass filters) */
    skipped: number;
}

/**
 * Final stats returned after all deletions are done.
 */
export interface DeleteStats {
    /** Successfully deleted */
    deleted: number;
    /** Failed to delete */
    failed: number;
    /** Total processed from the queue */
    scanned: number;
    /** Always 0 here (skipped happens during scan, not delete) */
    skipped: number;

    /** Timestamp when deletion started */
    startedAt: number;
    /** Timestamp when deletion finished */
    finishedAt: number;
}
