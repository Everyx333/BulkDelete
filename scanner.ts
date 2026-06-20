import { UserStore, RestAPI, Constants } from "@webpack/common";

import { DeleteFilters, ScanResult } from "./types";
import { passesFilters } from "./filters";

/**
 * Scan a channel for messages matching the given filters.
 *
 * Instead of relying on Discord's local MessageStore cache (which only
 * has messages you've scrolled past), this fetches messages directly
 * from Discord's REST API using cursor-based pagination.
 *
 * Algorithm:
 * 1. Fetch 100 messages (the max per request) before the current cursor.
 * 2. For each message, check if it's yours (or a bot response you
 *    triggered) and passes all filter criteria.
 * 3. Push matching messages to the queue.
 * 4. Set the cursor to the oldest fetched message and repeat.
 * 5. Stop when we have enough messages or run out of history.
 *
 * Returns a ScanResult with the queue, total scanned, and total skipped.
 * No deletion happens here — this is just discovery.
 */
export async function scanMessages(
    channelId: string,
    filters: DeleteFilters
): Promise<ScanResult> {
    const me = UserStore.getCurrentUser().id;

    const queue: any[] = [];
    const seen = new Set<string>();

    let scanned = 0;
    let skipped = 0;
    let cursor: string | undefined;

    while (queue.length < filters.amount) {
        const query: Record<string, any> = { limit: 100 };

        if (filters.before && !cursor)
            query.before = filters.before;
        else if (cursor)
            query.before = cursor;

        if (filters.after)
            query.after = filters.after;

        let messages: any[];
        try {
            const response = await RestAPI.get({
                url: Constants.Endpoints.MESSAGES(channelId),
                query
            });
            messages = response.body;
        } catch {
            break;
        }

        if (!messages || messages.length === 0)
            break;

        for (const msg of messages) {
            if (seen.has(msg.id))
                continue;

            seen.add(msg.id);
            scanned++;

            const isMine = msg.author?.id === me;
            const isMyInteraction = filters.includeBotMessages && msg.interaction?.user?.id === me;

            if (!isMine && !isMyInteraction) {
                skipped++;
                continue;
            }

            if (!passesFilters(msg, filters)) {
                skipped++;
                continue;
            }

            queue.push(msg);

            if (queue.length >= filters.amount)
                break;
        }

        if (messages.length < 2)
            break;

        cursor = messages[messages.length - 1].id;

        const afterId = filters.after;
        if (afterId && cursor) {
            if (BigInt(cursor) <= BigInt(afterId))
                break;
        }
    }

    return {
        queue,
        scanned,
        skipped
    };
}
