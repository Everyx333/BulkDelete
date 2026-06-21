import { openModal, Modal } from "@webpack/common";
import { DeleteFilters } from "./types";
import { plural } from "./utils";

/**
 * Props passed to the confirmation modal.
 * The modal is pure UI — it only displays info and calls back on button press.
 */
interface ConfirmModalProps {
    /** Number of messages that matched filters and will be deleted */
    found: number;
    /** Total messages inspected during scanning */
    scanned: number;
    /** The filters that produced these results (displayed for user verification) */
    filters: DeleteFilters;
    /** Delay between deletion steps from settings (used for time estimate) */
    interval: number;
    /** Whether anti-log mode is active (affects time estimate — 3 API calls per message vs 1) */
    antiLog: boolean;
    /** Called when user clicks "Delete" */
    onConfirm(): void;
    /** Called when user clicks "Cancel" */
    onCancel(): void;
}

/**
 * Open Discord's built-in confirmation modal after scanning finishes.
 *
 * Shows:
 *   - How many messages matched
 *   - How many were scanned total
 *   - The active filters
 *   - Estimated time based on interval setting + rate limit math
 *
 * The modal does NOT delete anything. It just asks "are you sure?"
 * and calls onConfirm / onCancel.
 */
export function openConfirmModal(props: ConfirmModalProps) {
    openModal(modalProps =>
        <Modal
            {...modalProps}
            title="Delete Messages"
            size="sm"
            actions={[
                {
                    text: "Delete",
                    variant: "critical-primary",
                    onClick() {
                        props.onConfirm();
                        modalProps.onClose();
                    }
                },
                {
                    text: "Cancel",
                    variant: "secondary",
                    onClick() {
                        props.onCancel();
                        modalProps.onClose();
                    }
                }
            ]}
        >
            <div style={{ marginBottom: 16 }}>
                <strong>Found {props.found} matching messages.</strong>
            </div>

            <div style={{ marginBottom: 16, color: "var(--text-muted)" }}>
                Scanned: {props.scanned.toLocaleString()} messages
            </div>

            <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Filters</div>
                <FilterList filters={props.filters} />
            </div>

            <div style={{ color: "var(--text-muted)" }}>
                Estimated time: ~{formatEstimate(props.found, props.interval, props.antiLog)}
            </div>
        </Modal>
    );
}

/**
 * Render the list of active filters as text lines.
 * Only shows filters the user actually set (skips undefined/false ones).
 */
function FilterList({ filters }: { filters: DeleteFilters }) {
    const items: string[] = [];

    if (filters.amount) items.push(`Amount: ${filters.amount}`);
    if (filters.contains) items.push(`Contains: ${filters.contains}`);
    if (filters.before) items.push(`Before message: ${filters.before}`);
    if (filters.after) items.push(`After message: ${filters.after}`);
    if (filters.olderThan) items.push(`Older than: ${plural(filters.olderThan, "day")}`);
    if (filters.newerThan) items.push(`Newer than: ${plural(filters.newerThan, "day")}`);
    if (filters.hasAttachments) items.push("Has Attachments: Yes");
    if (filters.hasEmbeds) items.push("Has Embeds: Yes");
    if (filters.hasLinks) items.push("Has Links: Yes");
    if (filters.includeBotMessages) items.push("Include bot messages: Yes");

    if (items.length === 0) return <div style={{ color: "var(--text-muted)", fontStyle: "italic" }}>None</div>;

    return (
        <div style={{ color: "var(--text-muted)" }}>
            {items.map((item, i) => (
                <div key={i}>{item}</div>
            ))}
        </div>
    );
}

/**
 * Estimate how long deletion will take.
 *
 * Formula:
 *   totalCalls = count × callsPerMessage (1 for regular, 3 for anti-log)
 *   base time = totalCalls × (interval + 100ms overhead)
 *   rate limit addon = every ~48 requests we hit remaining <= 2 and wait ~1s for budget reset
 *
 * This gives a rough-but-reasonable expectation without needing to know
 * Discord's exact rate limit state ahead of time.
 */
function formatEstimate(count: number, interval: number, antiLog: boolean): string {
    const callsPerMessage = antiLog ? 3 : 1;
    const totalCalls = count * callsPerMessage;
    const overhead = 100;

    let ms = totalCalls * (interval + overhead);

    if (totalCalls > 48) {
        const resets = Math.floor((totalCalls - 1) / 48);
        ms += resets * 1000;
    }

    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(0)} seconds`;
    return `${(ms / 60000).toFixed(0)} minutes`;
}
