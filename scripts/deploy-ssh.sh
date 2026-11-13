#!/usr/bin/env bash
set -euo pipefail
export PJOS_FORCE_SSH=1
export PJOS_DEVICE_IP=${PJOS_DEVICE_IP:-${HANDHELD_HOST:-}}
export PJOS_DEV_PW=${PJOS_DEV_PW:-${HANDHELD_PASSWORD:-}}
exec bash "$(dirname "$0")/deploy-rg34xx.sh" --deploy "$@"
