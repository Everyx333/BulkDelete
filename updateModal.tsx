import { openModal, closeModal, Modal } from "@webpack/common";

export function openUpdateModal(
    version: string,
    changelog: string,
    onYes: () => void,
    isDowngrade: boolean
) {
    openModal(modalProps =>
        <Modal
            {...modalProps}
            title={isDowngrade ? "Downgrade detected!" : "New version detected!"}
            size="sm"
            actions={[
                {
                    text: "Yes",
                    variant: "primary",
                    onClick() {
                        onYes();
                        modalProps.onClose();
                    }
                },
                {
                    text: "Cancel",
                    variant: "secondary",
                    onClick() {
                        modalProps.onClose();
                    }
                }
            ]}
        >
            <div style={{ marginBottom: 16, color: isDowngrade ? "var(--text-warning)" : "var(--text-positive)" }}>
                <strong>Version {version}</strong>
            </div>

            {changelog && (
                <div style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Changelog</div>
                    <div style={{ color: "var(--text-muted)", whiteSpace: "pre-wrap" }}>
                        {changelog}
                    </div>
                </div>
            )}

            <div style={{ color: "var(--text-muted)" }}>
                {isDowngrade
                    ? "Would you like to revert to this version?"
                    : "Would you like to install the update now?"}
            </div>
        </Modal>
    );
}

export function openInstallingModal(): string {
    return openModal(modalProps =>
        <Modal
            {...modalProps}
            title="Installing Update"
            size="sm"
            actions={[]}
        >
            <div style={{ color: "var(--text-muted)" }}>
                Cloning repository and building…
            </div>
        </Modal>
    );
}

export function openRestartPrompt() {
    openModal(modalProps =>
        <Modal
            {...modalProps}
            title="Update Complete"
            size="sm"
            actions={[
                {
                    text: "Yes",
                    variant: "primary",
                    onClick() {
                        modalProps.onClose();
                        VencordNative.pluginHelpers.BulkDelete.restartDiscord();
                    }
                },
                {
                    text: "Cancel",
                    variant: "secondary",
                    onClick() {
                        modalProps.onClose();
                    }
                }
            ]}
        >
            <div style={{ color: "var(--text-positive)", marginBottom: 16 }}>
                <strong>Update installed successfully!</strong>
            </div>
            <div style={{ color: "var(--text-muted)" }}>
                Would you like to restart Discord now?
            </div>
        </Modal>
    );
}

export function openErrorModal(error: string) {
    openModal(modalProps =>
        <Modal
            {...modalProps}
            title="Update Failed"
            size="sm"
            actions={[
                {
                    text: "OK",
                    variant: "primary",
                    onClick() {
                        modalProps.onClose();
                    }
                }
            ]}
        >
            <div style={{ color: "var(--text-danger)", whiteSpace: "pre-wrap" }}>
                {error}
            </div>
        </Modal>
    );
}
