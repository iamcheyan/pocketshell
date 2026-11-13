#!/usr/bin/env bash
set -euo pipefail
exec bash "$(dirname "$0")/deploy-rg34xx.sh" --check "$@"
