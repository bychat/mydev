#!/usr/bin/env bash
# Stage publishable npm packages from the monorepo build output.
# Usage: bash scripts/stage-packages.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "── Staging flovia-cli package ──"
CLI_PKG="$ROOT/packages/flovia-cli"
rm -rf "$CLI_PKG/dist-cli"
cp -r "$ROOT/dist-cli" "$CLI_PKG/dist-cli"
# Ensure shebang + executable
chmod +x "$CLI_PKG/dist-cli/cli/index.js"
echo "   ✔ dist-cli → packages/flovia-cli/dist-cli"

echo "── Staging flovia launcher package ──"
LAUNCHER_PKG="$ROOT/packages/flovia"
chmod +x "$LAUNCHER_PKG/bin/launch.js"
echo "   ✔ packages/flovia/bin/launch.js is ready"

echo ""
echo "Done. Packages ready to publish:"
echo "  cd packages/flovia     && npm publish --access public"
echo "  cd packages/flovia-cli && npm publish --access public"
