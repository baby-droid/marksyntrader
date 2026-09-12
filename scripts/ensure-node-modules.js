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
const requiredFiles = [
    path.join(root, 'node_modules', '.bin', 'rsbuild'),
    path.join(root, 'node_modules', '@rsbuild', 'core', 'compiled', 'html-rspack-plugin', 'loader.js'),
];

const isReady = () => requiredFiles.every(file => fs.existsSync(file));

if (!isReady()) {
    console.warn('[dependencies] Rsbuild toolchain is incomplete; restoring from package-lock.json...');
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const result = spawnSync(
        npm,
        ['ci', '--include=dev', '--no-audit', '--no-fund'],
        { cwd: root, stdio: 'inherit' }
    );

    if (result.error) {
        console.error(`[dependencies] Unable to run npm ci: ${result.error.message}`);
        process.exit(1);
    }
    if (result.status !== 0) {
        console.error(`[dependencies] npm ci failed with exit code ${result.status ?? 'unknown'}.`);
        process.exit(result.status || 1);
    }
}

if (!isReady()) {
    console.error('[dependencies] Rsbuild is still incomplete after dependency restore.');
    process.exit(1);
}
