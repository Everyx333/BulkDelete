/**
* This file is made for auto updates!
*/
import { execFile } from "child_process";
import { IpcMainInvokeEvent } from "electron";
import { join } from "path";
import { promisify } from "util";
import { existsSync, rmSync, readFileSync } from "fs";

const execFileAsync = promisify(execFile);

/**
 * Vencord repo root — native.ts is compiled into dist/patcher.js,
 * so __dirname is dist/ and joining with ".." gives the repo root.
 */
const VENCORD_SRC_DIR = join(__dirname, "..");
const PLUGIN_DIR = join(VENCORD_SRC_DIR, "src", "userplugins", "bulkDelete");

/**
 * Read the local version.txt file and return the version string (first line).
 * Returns null if the file doesn't exist or can't be read.
 */
export async function getLocalVersion(_e: IpcMainInvokeEvent): Promise<string | null> {
    try {
        const versionPath = join(PLUGIN_DIR, "version.txt");
        if (!existsSync(versionPath)) return null;
        const lines = readFileSync(versionPath, "utf-8").trim().split("\n");
        return lines[0] || null;
    } catch {
        return null;
    }
}

/**
 * Read the local version.txt and return everything after the first line
 * (the changelog for the current version).
 */
export async function getLocalChangelog(_e: IpcMainInvokeEvent): Promise<string> {
    try {
        const versionPath = join(PLUGIN_DIR, "version.txt");
        if (!existsSync(versionPath)) return "";
        const lines = readFileSync(versionPath, "utf-8").trim().split("\n");
        return lines.slice(1).join("\n").trim();
    } catch {
        return "";
    }
}

/**
 * Perform a full update:
 * 1. Remove the old plugin directory
 * 2. git clone the repo fresh
 * 3. Run the Vencord build script
 *
 * The user needs to restart Discord afterward for changes to take effect.
 */
export async function updatePlugin(_e: IpcMainInvokeEvent): Promise<void> {
    if (existsSync(PLUGIN_DIR)) {
        rmSync(PLUGIN_DIR, { recursive: true, force: true });
    }

    await execFileAsync("git", [
        "clone",
        "https://github.com/Everyx333/BulkDelete.git",
        PLUGIN_DIR
    ]);

    await execFileAsync("node", [
        "--require",
        "./scripts/suppressExperimentalWarnings.js",
        "scripts/build/build.mjs"
    ], { cwd: VENCORD_SRC_DIR });
}
