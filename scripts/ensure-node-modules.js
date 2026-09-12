#!/usr/bin/env node

/*
 * Replit workflows can start before the workspace dependency volume has been
 * restored. Rsbuild then fails inside html-rspack-plugin with a misleading
 * loader-resolution error. Keep the normal startup fast, but repair an
 * incomplete install from the checked-in lockfile when the toolchain is
 * actually missing.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const installLock = path.join(root, '.node-modules-install.lock');
const requiredFiles = [
    path.join(root, 'node_modules', '.bin', 'rsbuild'),
    path.join(root, 'node_modules', '@rsbuild', 'core', 'compiled', 'html-rspack-plugin', 'loader.js'),
];

const isReady = () => requiredFiles.every(file => fs.existsSync(file));

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const readOwnerPid = () => {
    try {
        const value = fs.readFileSync(path.join(installLock, 'pid'), 'utf8').trim();
        return Number.parseInt(value, 10);
    } catch {
        return null;
    }
};

const isPidAlive = pid => {
    if (!Number.isInteger(pid) || pid <= 0) return false;
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
};

const acquireInstallLock = async () => {
    const deadline = Date.now() + 180_000;
    while (true) {
        try {
            fs.mkdirSync(installLock);
            fs.writeFileSync(path.join(installLock, 'pid'), String(process.pid));
            return;
        } catch (error) {
            if (error.code !== 'EEXIST') throw error;

            const ownerPid = readOwnerPid();
            if (ownerPid && !isPidAlive(ownerPid)) {
                fs.rmSync(installLock, { recursive: true, force: true });
                continue;
            }
            if (Date.now() >= deadline) {
                throw new Error('Timed out waiting for another dependency repair to finish.');
            }
            await sleep(500);
        }
    }
};

const releaseInstallLock = () => {
    const ownerPid = readOwnerPid();
    if (ownerPid === process.pid || !ownerPid) {
        fs.rmSync(installLock, { recursive: true, force: true });
    }
};

const restoreDependencies = () => {
    console.warn('[dependencies] Rsbuild toolchain is incomplete; restoring from package-lock.json...');
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const result = spawnSync(
        npm,
        ['ci', '--include=dev', '--no-audit', '--no-fund'],
        {
            cwd: root,
            stdio: 'inherit',
            env: { ...process.env, NODE_ENV: '' },
        }
    );

    if (result.error) {
        throw new Error(`Unable to run npm ci: ${result.error.message}`);
    }
    if (result.status !== 0) {
        throw new Error(`npm ci failed with exit code ${result.status ?? 'unknown'}.`);
    }
};

const main = async () => {
    if (isReady()) return;

    await acquireInstallLock();
    try {
        // A second workflow may have repaired the tree while we waited.
        if (!isReady()) restoreDependencies();
    } finally {
        releaseInstallLock();
    }

    if (!isReady()) {
        throw new Error('Rsbuild is still incomplete after dependency restore; html-rspack-plugin/loader.js is missing.');
    }
};

main().catch(error => {
    console.error(`[dependencies] ${error.message}`);
    process.exit(1);
});
