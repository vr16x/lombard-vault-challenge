#!/usr/bin/env bash
# Starts a local Anvil fork of Ethereum mainnet on RPC_URL's port (default 8545).
set -euo pipefail
cd "$(dirname "$0")/.."

set -a
# shellcheck disable=SC1091
source .env
set +a

# Fork source: FORK_RPC_URL if set, otherwise a free public mainnet RPC (fine for quick runs; a keyed RPC is
# more reliable for long sessions and needed to pin an old FORK_BLOCK_NUMBER).
DEFAULT_FORK_RPC_URL="https://ethereum-rpc.publicnode.com"
FORK_RPC_URL="${FORK_RPC_URL:-$DEFAULT_FORK_RPC_URL}"
# Port from RPC_URL (e.g. http://127.0.0.1:8545/), falling back to Anvil's default.
PORT="$(printf '%s' "${RPC_URL:-}" | sed -nE 's#^[a-zA-Z]+://[^/]*:([0-9]+)([/?].*)?$#\1#p')"
PORT="${PORT:-8545}"

# Pass FORK_BLOCK_NUMBER to pin the fork for reproducible runs; defaults to the latest block.
exec anvil --fork-url "$FORK_RPC_URL" --port "$PORT" ${FORK_BLOCK_NUMBER:+--fork-block-number "$FORK_BLOCK_NUMBER"}
