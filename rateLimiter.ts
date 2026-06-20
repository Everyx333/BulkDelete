import { RestAPI, Constants } from "@webpack/common";
import { sleep } from "./utils";

/**
 * Tracks Discord's rate limit state and pauses when needed.
 *
 * Discord allows roughly 50 delete requests per minute before
 * returning HTTP 429 (Too Many Requests). This class monitors
 * the x-ratelimit-remaining and x-ratelimit-reset headers from
 * API responses to know when it's safe to send the next request.
 */
export class RateLimiter {
    private remaining = 50;
    private resetAt = Date.now() + 1000;

    /**
     * If we're close to the rate limit (<= 2 remaining), wait
     * until the reset time before proceeding.
     */
    async waitIfNeeded() {
        const now = Date.now();

        if (this.remaining <= 2) {
            const waitTime = Math.max(0, this.resetAt - now + 100);
            if (waitTime > 0) {
                console.log(`[RateLimit] ${this.remaining} left, waiting ${waitTime}ms...`);
                await sleep(waitTime);
                this.remaining = 50;
                this.resetAt = Date.now() + 1000;
            }
        }
    }

    /**
     * Parse rate limit headers from an API response and update
     * internal state so waitIfNeeded() can make accurate decisions.
     */
    update(headers: any) {
        if (!headers) return;

        const remaining = headers.get?.("x-ratelimit-remaining");
        const reset = headers.get?.("x-ratelimit-reset");
        const retryAfter = headers.get?.("retry-after");

        if (remaining != null) this.remaining = parseInt(remaining);
        if (reset != null) this.resetAt = parseInt(reset) * 1000;

        if (retryAfter) {
            this.resetAt = Date.now() + parseInt(retryAfter) * 1000 + 200;
        }
    }

    /**
     * Handle a rate limit error (HTTP 429) by extracting the
     * retry-after value and updating the reset timestamp.
     */
    handleError(error: any) {
        if (error?.status === 429) {
            const retryAfter = error?.headers?.get?.("retry-after") || error?.retry_after || 1;
            this.resetAt = Date.now() + parseInt(retryAfter) * 1000 + 200;
        }
    }
}

/**
 * Delete a single message via Discord's REST API.
 * - Waits for rate limit clearance before sending
 * - Retries up to 3 times on HTTP 429 (rate limited)
 * - Returns false on any other error (message already deleted, no permission, etc.)
 */
export async function deleteMessage(
    channelId: string,
    messageId: string,
    limiter: RateLimiter
): Promise<boolean> {
    for (let retries = 0; retries < 3; retries++) {
        try {
            await limiter.waitIfNeeded();

            const response = await RestAPI.del({
                url: Constants.Endpoints.MESSAGE(channelId, messageId)
            });

            limiter.update(response.headers);
            return true;
        } catch (error: any) {
            if (error?.status === 429) {
                limiter.handleError(error);
                continue;
            }
            return false;
        }
    }
    return false;
}

/**
 * Delete a message with anti-logger protection.
 *
 * How it works:
 * 1. Post a placeholder message (e.g. "message logging blocked...") with
 *    the original message's ID as the nonce. Discord may treat this as
 *    replacing the original message content.
 * 2. Wait a short interval.
 * 3. Delete the original message.
 * 4. Wait again.
 * 5. Delete the placeholder (if it's a different message from the original).
 *
 * This prevents message-loggers(at least Vencords Built in message logger.) from seeing the original content,
 * because the placeholder overwrites it before deletion.
 */
export async function antiLogDeleteMessage(
    channelId: string,
    messageId: string,
    blockMessage: string,
    interval: number,
    limiter: RateLimiter
): Promise<boolean> {
    await limiter.waitIfNeeded();

    const placeholderResponse = await RestAPI.post({
        url: Constants.Endpoints.MESSAGES(channelId),
        body: {
            content: blockMessage,
            flags: 0,
            mobile_network_type: "unknown",
            nonce: messageId,
            tts: false,
        }
    });

    await sleep(interval);

    const ok = await deleteMessage(channelId, messageId, limiter);
    if (!ok) return false;

    await sleep(interval);

    const placeholderId = placeholderResponse.body.id;
    if (placeholderId !== messageId) {
        await deleteMessage(channelId, placeholderId, limiter);
    }

    return true;
}
