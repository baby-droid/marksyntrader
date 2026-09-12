#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Keep merged task environments reproducible through the same serialized,
# lockfile-based dependency repair used by the dev and build entry points.
node scripts/ensure-node-modules.js
npm run build