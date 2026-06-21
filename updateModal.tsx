import { openModal, Modal } from "@webpack/common";

/**
 * Open a modal telling the user a new version is available.
 * If they click Yes, the update process is run (clone + build).
 * If Cancel, the modal just closes.
 */
export function openUpdateModal(
    version: string,
    changelog: string,
    onYes: () => void
) {
    openModal(modalProps =>
        <Modal
            {...modalProps}
            title="New version detected!"
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
            <div style={{ marginBottom: 16, color: "var(--text-positive)" }}>
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
                Would you like to install the update now?
            </div>
        </Modal>
    );
}

/**
 * Open a modal telling the user an update is being installed.
 */
export function openInstallingModal() {
    openModal(modalProps =>
        <Modal
            {...modalProps}
            title="Installing Update"
            size="sm"
            actions={[]}
        >
            <div style={{ color: "var(--text-muted)" }}>
                Cloning repository and building… Discord will need to be restarted when complete.
            </div>
        </Modal>
    );
}

/**
 * Open a modal telling the user the update was installed.
 */
export function openRestartModal() {
    openModal(modalProps =>
        <Modal
            {...modalProps}
            title="Update Complete"
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
            <div style={{ color: "var(--text-muted)" }}>
                The update has been installed. Please restart Discord for the changes to take effect.
            </div>
        </Modal>
    );
}

/**
 * Open a modal telling the user an error occurred.
 */
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
