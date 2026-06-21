import definePlugin, { PluginNative } from "@utils/types";
import {
    ApplicationCommandInputType,
    ApplicationCommandOptionType,
    sendBotMessage
} from "@api/Commands";
import { Devs } from "@utils/constants";
import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

import { closeModal } from "@webpack/common";

import { scanMessages } from "./scanner";
import { deleteQueue } from "./deleteQueue";
import { openConfirmModal } from "./confirmModal";
import { openUpdateModal, openInstallingModal, openRestartPrompt, openErrorModal } from "./updateModal";
import { RateLimiter, deleteMessage, antiLogDeleteMessage } from "./rateLimiter";
import { DeleteFilters } from "./types";
import { formatTime } from "./utils";

function getNative() {
    return VencordNative.pluginHelpers.BulkDelete as PluginNative<typeof import("./native")>;
}

function compareVersions(a: string, b: string): number {
    const sa = a.split(".").map(Number);
    const sb = b.split(".").map(Number);
    for (let i = 0; i < Math.max(sa.length, sb.length); i++) {
        const va = sa[i] || 0;
        const vb = sb[i] || 0;
        if (va > vb) return 1;
        if (va < vb) return -1;
    }
    return 0;
}

const settings = definePluginSettings({
    blockMessage: {
        type: OptionType.STRING,
        description: "Text to display when blocking message logs",
        default: "this plugin was made by everyx <3",
    },
    deleteInterval: {
        type: OptionType.NUMBER,
        description: "Delay between deletion steps (milliseconds)",
        default: 50,
        min: 10,
        max: 500
    },
    showDetailedStats: {
        type: OptionType.BOOLEAN,
        description: "Show detailed statistics in notification",
        default: true
    },
    easeRateLimits: {
        type: OptionType.BOOLEAN,
        description: "Gradually slow down as the rate limit approaches (prevents Discord client from force-restarting on large deletes)",
        default: false
    }
});

function getArg(args: any[], name: string) {
    return args.find(a => a.name === name)?.value;
}

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

async function executeDelete(args: any[], ctx: any, antiLog: boolean) {
    const filters = parseFilters(args);
    const dryrun = getArg(args, "dryrun") ?? false;

    if (filters.amount <= 0) {
        sendBotMessage(ctx.channel.id, { content: "Amount must be greater than 0." });
        return;
    }

    const channelId = ctx.channel.id;

    sendBotMessage(ctx.channel.id, {
        content: `Scanning for ${filters.amount} messages${dryrun ? " (dry run)" : ""}…`
    });

    const result = await scanMessages(channelId, filters);

    if (result.queue.length === 0) {
        sendBotMessage(ctx.channel.id, {
            content: `No matching messages found.\nScanned: ${result.scanned}, skipped ${result.skipped} (not yours or filtered out).`
        });
        return;
    }

    const interval = settings.store.deleteInterval || 50;
    const total = result.queue.length;

    if (!dryrun) {
        const confirmed = await new Promise<boolean>(resolve => {
            openConfirmModal({
                found: total,
                scanned: result.scanned,
                filters,
                interval,
                antiLog,
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
    const limiter = new RateLimiter(settings.store.easeRateLimits, interval);
    const blockMessage = settings.store.blockMessage;

    if (dryrun) {
        const elapsed = Date.now() - startTime;
        sendBotMessage(ctx.channel.id, {
            content: `**DRY RUN Complete**\n• Would delete: ${total} messages\n• Scanned: ${result.scanned}\n• Time: ${formatTime(elapsed)}`
        });
        return;
    }

    const deleter = antiLog
        ? (msg: any) => antiLogDeleteMessage(channelId, msg.id, blockMessage, interval, limiter)
        : (msg: any) => deleteMessage(channelId, msg.id, limiter, interval);

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
            execute(args, ctx) {
                executeDelete(args, ctx, false).catch(console.error);
            }
        },
        {
            name: "delMsgLog",
            inputType: ApplicationCommandInputType.BUILT_IN,
            description: "Delete your messages with anti-logging protection",
            options: messageOptions,
            execute(args, ctx) {
                executeDelete(args, ctx, true).catch(console.error);
            }
        }
    ],

    async start() {
        try {
            const Native = getNative();

            const localVersion = await Native.getLocalVersion();
            if (!localVersion) return;

            const remoteFull = await Native.fetchRemoteVersion();
            if (!remoteFull) return;

            const lines = remoteFull.trim().split("\n");
            const remoteVersion = lines[0];
            if (!remoteVersion) return;

            const cmp = compareVersions(localVersion, remoteVersion);
            if (cmp === 0) return;

            const isDowngrade = cmp > 0;
            const changelog = lines.slice(1).join("\n").trim();

            openUpdateModal(remoteVersion, changelog, async () => {
                const modalKey = openInstallingModal();

                try {
                    await Native.updatePlugin();
                    closeModal(modalKey);
                    openRestartPrompt();
                } catch (err: any) {
                    closeModal(modalKey);
                    openErrorModal(err?.message || String(err));
                }
            }, isDowngrade);
        } catch (e) {
            console.error("[BulkDelete] Version check failed:", e);
        }
    }
});
