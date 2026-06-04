#!/bin/bash
# SessionStart hook: install dependencies so lint / tests / build work in
# Claude Code on the web. Synchronous and idempotent.
set -euo pipefail

# Only needed in the remote (web) environment; local checkouts already have
# their dependencies installed.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$ROOT"

# `npm install` (not `ci`) so the cached container keeps node_modules warm.
npm install --no-audit --no-fund
