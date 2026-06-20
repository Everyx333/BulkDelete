/**
 * BulkDelete — Vencord plugin for mass-deleting your messages.
 *
 * Exposes two slash commands:
 *   /delMsg     — Simple deletion with text/attachment/date filters
 *   /delMsgLog  — Anti-logger deletion (overwrites message content before deleting)
 *
 * Architecture (no Discord client cache dependency):
 *   Slash command → parse filters → scanMessages (REST API pagination)
 *   → confirmModal (are you sure?) → deleteQueue (iterates queue)
 *   → rateLimiter (avoids 429s) → Discord REST API → completion message
 */

import definePlugin from "@utils/types";
import {
    ApplicationCommandInputType,
    ApplicationCommandOptionType,
    sendBotMessage
} from "@api/Commands";
import { Devs } from "@utils/constants";
import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

import { scanMessages } from "./scanner";
import { deleteQueue } from "./deleteQueue";
import { openConfirmModal } from "./confirmModal";
import { RateLimiter, deleteMessage, antiLogDeleteMessage } from "./rateLimiter";
import { DeleteFilters } from "./types";
import { formatTime } from "./utils";

/**
 * Plugin settings accessible from Discord's settings UI.
 *
 * - blockMessage: Text that briefly replaces a message before deletion
 *   (only used by /delMsgLog to hide the original content from loggers)
 * - deleteInterval: Pause between anti-log steps (placeholder post, delete, delete)
 * - showDetailedStats: Whether to include scan counts and timing in the result message
 */
const settings = definePluginSettings({
    blockMessage: {
        type: OptionType.STRING,
        description: "Text to display when blocking message logs",
        default: "message logging blocked with an anti-messagelogger plugin.",
    },
    deleteInterval: {
        type: OptionType.NUMBER,
        description: "Delay in milliseconds between anti-log steps",
        default: 50,
        min: 10,
        max: 500
    },
    showDetailedStats: {
        type: OptionType.BOOLEAN,
        description: "Show detailed statistics in notification",
        default: true
    }
});

/** Look up a slash command argument by its name */
function getArg(args: any[], name: string) {
    return args.find(a => a.name === name)?.value;
}

/** Convert raw slash command arguments into a typed DeleteFilters object */
function parseFilters(args: any[]): DeleteFilters {
    return {
        amount: Number(getArg(args, "amount")) || 1,
        before: getArg(args, "before"),
        after: getArg(args, "after"),
        contains: getArg(args, "contains"),
        hasAttachments: getArg(args, "hasAttachments"),
        hasEmbeds: getArg(args, "hasEmbeds"),
        hasLinks: getArg(args, "hasLinks"),
        olderThan: getArg(args, "olderThan"),
        newerThan: getArg(args, "newerThan"),
        includeBotMessages: getArg(args, "includeBotMessages") ?? true,
    };
}

/**
 * Core execution flow shared by both /delMsg and /delMsgLog.
 *
 * Steps:
 * 1. Parse filters from command arguments
 * 2. Scan the channel via REST API (no client cache dependency)
 * 3. Show a confirmation modal (skipped in dry-run mode)
 * 4. Delete every message in the queue
 * 5. Send a completion message to the channel
 */
async function executeDelete(args: any[], ctx: any, antiLog: boolean) {
    const filters = parseFilters(args);
    const dryrun = getArg(args, "dryrun") ?? false;

    if (filters.amount <= 0) {
        sendBotMessage(ctx.channel.id, { content: "Amount must be greater than 0." });
        return;
    }

    const channelId = ctx.channel.id;

    const result = await scanMessages(channelId, filters);

    if (result.queue.length === 0) {
        sendBotMessage(ctx.channel.id, {
            content: `No matching messages found.\nScanned: ${result.scanned}, skipped ${result.skipped} (not yours or filtered out).`
        });
        return;
    }

    if (!dryrun) {
        const confirmed = await new Promise<boolean>(resolve => {
            openConfirmModal({
                found: result.queue.length,
                scanned: result.scanned,
                filters,
                onConfirm: () => resolve(true),
                onCancel: () => resolve(false),
            });
        });

        if (!confirmed) {
            sendBotMessage(ctx.channel.id, { content: "Deletion cancelled." });
            return;
        }
    }

    const startTime = Date.now();
    const limiter = new RateLimiter();
    const interval = settings.store.deleteInterval || 50;
    const blockMessage = settings.store.blockMessage;

    if (dryrun) {
        const elapsed = Date.now() - startTime;
        sendBotMessage(ctx.channel.id, {
            content: `**DRY RUN Complete**\n• Would delete: ${result.queue.length} messages\n• Scanned: ${result.scanned}\n• Time: ${formatTime(elapsed)}`
        });
        return;
    }

    const deleter = antiLog
        ? (msg: any) => antiLogDeleteMessage(channelId, msg.id, blockMessage, interval, limiter)
        : (msg: any) => deleteMessage(channelId, msg.id, limiter);

    const stats = await deleteQueue(result.queue, deleter);

    const elapsed = Date.now() - startTime;
    const mode = antiLog ? " (anti-log)" : "";

    let content = `✅ **Deletion Complete${mode}**\n• Deleted: ${stats.deleted} messages\n• Failed: ${stats.failed}`;

    if (settings.store.showDetailedStats) {
        content += `\n• Scanned: ${result.scanned}\n• Elapsed: ${formatTime(elapsed)}`;
    }

    if (stats.failed > 0) {
        content += `\n\n⚠️ ${stats.failed} message${stats.failed > 1 ? "s" : ""} could not be deleted.`;
    }

    sendBotMessage(ctx.channel.id, { content });
}

/**
 * Slash command option definitions shared by both commands.
 * Each option maps to a field in DeleteFilters.
 */
const messageOptions = [
    {
        name: "amount",
        description: "Number of messages to delete",
        type: ApplicationCommandOptionType.INTEGER,
        required: true
    },
    {
        name: "contains",
        description: "Only delete messages containing this text",
        type: ApplicationCommandOptionType.STRING,
        required: false
    },
    {
        name: "hasAttachments",
        description: "Only delete messages with attachments",
        type: ApplicationCommandOptionType.BOOLEAN,
        required: false
    },
    {
        name: "hasEmbeds",
        description: "Only delete messages with embeds",
        type: ApplicationCommandOptionType.BOOLEAN,
        required: false
    },
    {
        name: "hasLinks",
        description: "Only delete messages with links",
        type: ApplicationCommandOptionType.BOOLEAN,
        required: false
    },
    {
        name: "olderThan",
        description: "Only delete messages older than N days",
        type: ApplicationCommandOptionType.INTEGER,
        required: false
    },
    {
        name: "newerThan",
        description: "Only delete messages newer than N days",
        type: ApplicationCommandOptionType.INTEGER,
        required: false
    },
    {
        name: "before",
        description: "Only delete messages sent before this message ID",
        type: ApplicationCommandOptionType.STRING,
        required: false
    },
    {
        name: "after",
        description: "Only delete messages sent after this message ID",
        type: ApplicationCommandOptionType.STRING,
        required: false
    },
    {
        name: "includeBotMessages",
        description: "Also delete bot messages triggered by your slash commands",
        type: ApplicationCommandOptionType.BOOLEAN,
        required: false
    },
    {
        name: "dryrun",
        description: "Simulate deletion without actually deleting",
        type: ApplicationCommandOptionType.BOOLEAN,
        required: false
    }
];

export default definePlugin({
    name: "BulkDelete",
    description: "Bulk delete your messages with filters and anti-logging protection",
    authors: [Devs.Ven],
    settings,

    commands: [
        {
            name: "delMsg",
            inputType: ApplicationCommandInputType.BUILT_IN,
            description: "Delete your messages with filters",
            options: messageOptions,
            execute(args, ctx) { return executeDelete(args, ctx, false); }
        },
        {
            name: "delMsgLog",
            inputType: ApplicationCommandInputType.BUILT_IN,
            description: "Delete your messages with anti-logging protection",
            options: messageOptions,
            execute(args, ctx) { return executeDelete(args, ctx, true); }
        }
    ]
});
