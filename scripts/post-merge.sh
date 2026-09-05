#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Keep merged task environments reproducible and rebuild generated assets.
npm ci --no-audit --no-fund
npm run build