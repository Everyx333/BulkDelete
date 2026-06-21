/**
* This file is made for auto updates!
*/
import { execFile } from "child_process";
import { app, IpcMainInvokeEvent } from "electron";
import { get as httpsGet } from "https";
import { join } from "path";
import { promisify } from "util";
import { existsSync, rmSync, readFileSync } from "fs";

const execFileAsync = promisify(execFile);

const VENCORD_SRC_DIR = join(__dirname, "..");
const PLUGIN_DIR = join(VENCORD_SRC_DIR, "src", "userplugins", "bulkDelete");

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function rmDirSafe(dir: string, maxRetries = 5): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
        try {
            rmSync(dir, { recursive: true, force: true });
            return;
        } catch (err: any) {
            if (err.code !== "EBUSY" && err.code !== "EPERM") throw err;
            if (i === maxRetries - 1) throw err;
            await sleep(500 * (i + 1));
        }
    }
}

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

export async function fetchRemoteVersion(_e: IpcMainInvokeEvent): Promise<string | null> {
    return new Promise((resolve) => {
        httpsGet("https://raw.githubusercontent.com/Everyx333/BulkDelete/main/version.txt", (res) => {
            if (res.statusCode !== 200) {
                resolve(null);
                return;
            }
            let data = "";
            res.on("data", (chunk) => { data += chunk; });
            res.on("end", () => resolve(data));
        }).on("error", () => resolve(null));
    });
}

export async function updatePlugin(_e: IpcMainInvokeEvent): Promise<void> {
    const gitDir = join(PLUGIN_DIR, ".git");
    const isGitRepo = existsSync(gitDir);

    if (isGitRepo) {
        await execFileAsync("git", ["fetch", "origin", "main"], { cwd: PLUGIN_DIR });
        await execFileAsync("git", ["reset", "--hard", "origin/main"], { cwd: PLUGIN_DIR });
    } else {
        if (existsSync(PLUGIN_DIR)) {
            await rmDirSafe(PLUGIN_DIR);
        }
        await execFileAsync("git", [
            "clone",
            "https://github.com/Everyx333/BulkDelete.git",
            PLUGIN_DIR
        ]);
    }

    await execFileAsync("node", [
        "--require",
        "./scripts/suppressExperimentalWarnings.js",
        "scripts/build/build.mjs"
    ], { cwd: VENCORD_SRC_DIR });
}

export async function restartDiscord(_e: IpcMainInvokeEvent): Promise<void> {
    app.relaunch();
    app.exit(0);
}
