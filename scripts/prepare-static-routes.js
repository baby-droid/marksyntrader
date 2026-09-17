const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const outputRoots = ['dist', 'out/preview']
    .map((relativeRoot) => path.join(projectRoot, relativeRoot))
    .filter((outputRoot) => fs.existsSync(path.join(outputRoot, 'index.html')));

for (const outputRoot of outputRoots) {
    const callbackDirectory = path.join(outputRoot, 'callback');
    fs.mkdirSync(callbackDirectory, { recursive: true });
    fs.copyFileSync(path.join(outputRoot, 'index.html'), path.join(callbackDirectory, 'index.html'));
}

if (outputRoots.length === 0) {
    throw new Error('No built output found; cannot prepare the OAuth callback route.');
}