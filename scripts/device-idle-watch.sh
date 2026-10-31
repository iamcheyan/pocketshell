#!/usr/bin/env bash
# Watch a package on the handheld without touching it: install, restart the
# frontend, then sample the runtime pid for N seconds and report every restart.
#
#   device-idle-watch.sh [package] [seconds] [interval]
#
# Leaves the installed boot.pocket in place; restore it yourself afterwards:
#   scripts/deploy.sh <previous package>
set -euo pipefail

REPO=$(cd "$(dirname "$0")/.." && pwd)
PKG=${1:-$REPO/dist/pocketshell.pocket}
DURATION=${2:-480}
INTERVAL=${3:-30}
JUMP=${HANDHELD_JUMP:-HX90}
SERIAL=${HANDHELD_SERIAL:-5c0010894414c802512}
APPS=/storage/System/pocketjs/apps
LOG=${LOG:-$REPO/dist/idle-watch.log}

mkdir -p "$REPO/dist"
: > "$LOG"
say() { printf '%s %s\n' "$(date +%H:%M:%S)" "$*" | tee -a "$LOG"; }

scp -q "$PKG" "$JUMP:/tmp/watch.pocket"
ssh "$JUMP" "adb -s $SERIAL push /tmp/watch.pocket /storage/pjs/watch.pocket >/dev/null"

say "backup + install"
ssh "$JUMP" "adb -s $SERIAL shell 'cp -f $APPS/boot.pocket $APPS/boot.pocket.watch-backup && cp -f /storage/pjs/watch.pocket $APPS/boot.pocket && sync && sha256sum $APPS/boot.pocket'" | tee -a "$LOG"

say "restart"
OLD=$(ssh "$JUMP" "adb -s $SERIAL shell 'pidof pocket-linux-kms || true'" | tr -d '\r')
ssh "$JUMP" "adb -s $SERIAL shell 'kill -9 $OLD 2>/dev/null || true'"
sleep 8

last=""
elapsed=0
restarts=0
while [ "$elapsed" -lt "$DURATION" ]; do
	pid=$(ssh "$JUMP" "adb -s $SERIAL shell 'pidof pocket-linux-kms || true'" | tr -d '\r')
	if [ -z "$pid" ]; then
		say "t=${elapsed}s PID GONE"
		restarts=$((restarts + 1))
	elif [ "$pid" != "$last" ]; then
		if [ -n "$last" ]; then
			say "t=${elapsed}s pid changed $last -> $pid"
			restarts=$((restarts + 1))
		else
			say "t=${elapsed}s running pid=$pid"
		fi
		last=$pid
	fi
	sleep "$INTERVAL"
	elapsed=$((elapsed + INTERVAL))
done

say "done: $restarts restart(s) in ${DURATION}s; last pid=$last"
ssh "$JUMP" "adb -s $SERIAL shell 'grep -c \"exit code\" /tmp/pocketjs-frontend.log; tail -4 /tmp/pocketjs-frontend.log'" | tee -a "$LOG"
