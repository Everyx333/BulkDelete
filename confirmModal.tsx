import { openModal, Modal } from "@webpack/common";
import { DeleteFilters } from "./types";
import { plural } from "./utils";

/**
 * Props passed to the confirmation modal when it's opened.
 * The modal itself is just a UI — it doesn't know how to delete messages.
 */
interface ConfirmModalProps {
    /** Number of messages that matched the filters */
    found: number;
    /** Total messages scanned during discovery */
    scanned: number;
    /** The filters that were used (displayed so the user can verify) */
    filters: DeleteFilters;
    /** Called when the user clicks "Delete" */
    onConfirm(): void;
    /** Called when the user clicks "Cancel" */
    onCancel(): void;
}

/**
 * Open Discord's built-in confirmation modal showing a summary of
 * what will be deleted. The user can review the filters and estimated
 * time before deciding to proceed or cancel.
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
                Estimated time: ~{formatEstimate(props.found)}
            </div>
        </Modal>
    );
}

/**
 * Render the list of active filters in a readable format.
 * Only shows filters that the user actually set.
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
 * Rough time estimate based on ~70ms per message (50ms API interval + 20ms overhead).
 */
function formatEstimate(count: number): string {
    const ms = count * 50 + count * 20;
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(0)} seconds`;
    return `${(ms / 60000).toFixed(0)} minutes`;
}
