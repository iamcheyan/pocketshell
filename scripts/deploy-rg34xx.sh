#!/usr/bin/env bash
set -euo pipefail

repo=$(cd "$(dirname "$0")/.." && pwd)
pjos=${PJOS_ROOT:-"$repo/../PJOS-LINUX"}
mode=${1:---deploy}
if [ "$mode" = --check ] || [ "$mode" = --deploy ]; then shift || :; else mode=--deploy; fi
package=${1:-"$repo/dist/pocketshell.pocket"}
runtime=${PJOS_RUNTIME:-"$pjos/work/pocketjs-runtime/pocket-linux-kms"}
device_stage="/tmp/pjos-ui-$(date +%Y%m%d%H%M%S)-$$"
local_stage=$(mktemp -d)
transport=
serial=${PJOS_ADB_SERIAL:-}

cleanup() {
    if [ -n "$transport" ]; then remote "rm -rf '$device_stage'" >/dev/null 2>&1 || :; fi
    rm -rf "$local_stage"
}
trap cleanup EXIT

for input in "$package" "$runtime" "$repo/scripts/install-rg34xx.sh" \
    "$pjos/overlay/usr/share/pocketshell/System/launch_frontend.sh" \
    "$pjos/overlay/usr/share/pocketshell/System/compat/bin/pocketshell-games" \
    "$pjos/overlay/usr/share/pocketshell/System/compat/bin/pocketshell-play" \
    "$pjos/overlay/usr/share/pocketshell/System/compat/bin/pocket-game-play" \
    "$pjos/overlay/usr/share/pocketshell/System/compat/bin/pocketjs-native-launch"; do
    [ -f "$input" ] || { printf 'missing input: %s\n' "$input" >&2; exit 1; }
done
file "$runtime" | grep -q 'ARM aarch64.*statically linked' || { echo 'runtime is not a static AArch64 binary' >&2; exit 1; }
if grep -aq PJOS_HEADLESS_CAPTURE "$runtime"; then echo 'refusing debug runtime' >&2; exit 1; fi
grep -aq '/storage/System/compat/bin/pocketshell-play' "$runtime" || { echo 'runtime is missing the current card-player bridge; rebuild it first' >&2; exit 1; }
grep -aq '/storage/System/compat/bin/pocketjs-native-launch' "$runtime" || { echo 'runtime is missing the current native-app bridge; rebuild it first' >&2; exit 1; }

if [ "${PJOS_FORCE_SSH:-0}" != 1 ] && command -v adb >/dev/null 2>&1; then
    if [ -z "$serial" ]; then
        mapfile -t devices < <(adb devices | awk 'NR > 1 && $2 == "device" { print $1 }')
        if [ "${#devices[@]}" = 1 ]; then serial=${devices[0]}; fi
    fi
    if [ -n "$serial" ] && [ "$(adb -s "$serial" get-state 2>/dev/null || :)" = device ]; then transport=adb; fi
fi
if [ -z "$transport" ]; then
    : "${PJOS_DEVICE_IP:?Set PJOS_DEVICE_IP when USB ADB is unavailable}"
    : "${PJOS_DEV_PW:?Set PJOS_DEV_PW for password-assisted SSH}"
    [[ "$PJOS_DEVICE_IP" =~ ^[a-zA-Z0-9.:-]+$ ]] || { echo 'invalid device address' >&2; exit 1; }
    command -v sshpass >/dev/null || { echo 'sshpass is required for Wi-Fi deployment' >&2; exit 1; }
    export SSHPASS=$PJOS_DEV_PW
    transport=ssh
fi

remote() {
    if [ "$transport" = adb ]; then
        local output status
        output=$(adb -s "$serial" shell "$1; _pjos_status=\$?; printf '\\n__PJOS_STATUS_%s\\n' \"\$_pjos_status\"" | tr -d '\r') || return 1
        [[ "$output" == *'__PJOS_STATUS_'* ]] || { echo 'ADB command did not return a status' >&2; return 1; }
        status=${output##*__PJOS_STATUS_}
        printf '%s\n' "${output%__PJOS_STATUS_*}"
        [ "$status" = 0 ]
    else
        sshpass -e ssh -o ConnectTimeout=5 -o UserKnownHostsFile=/tmp/pjos-debug-known-hosts -o StrictHostKeyChecking=accept-new "root@$PJOS_DEVICE_IP" "$1"
    fi
}
push() {
    if [ "$transport" = adb ]; then adb -s "$serial" push "$1" "$2" >/dev/null;
    else sshpass -e scp -O -o ConnectTimeout=5 -o UserKnownHostsFile=/tmp/pjos-debug-known-hosts -o StrictHostKeyChecking=accept-new "$1" "root@$PJOS_DEVICE_IP:$2" >/dev/null; fi
}
pull() {
    if [ "$transport" = adb ]; then adb -s "$serial" pull "$1" "$2" >/dev/null;
    else sshpass -e scp -O -o ConnectTimeout=5 -o UserKnownHostsFile=/tmp/pjos-debug-known-hosts -o StrictHostKeyChecking=accept-new "root@$PJOS_DEVICE_IP:$1" "$2" >/dev/null; fi
}

identity=$(remote 'hostname; id')
[[ "$identity" == *rg34xx* && "$identity" == *'uid=0(root)'* ]] || { echo 'target identity is not the expected root RG34XX' >&2; exit 1; }
cp "$package" "$local_stage/boot.pocket"
cp "$runtime" "$local_stage/pocket-linux-kms"
cp "$repo/scripts/install-rg34xx.sh" "$local_stage/install.sh"
cp "$pjos/overlay/usr/share/pocketshell/System/launch_frontend.sh" "$local_stage/launch_frontend.sh"
for name in pocketshell-games pocketshell-play pocket-game-play pocketjs-native-launch; do
    cp "$pjos/overlay/usr/share/pocketshell/System/compat/bin/$name" "$local_stage/$name"
done
(cd "$local_stage" && sha256sum boot.pocket pocket-linux-kms install.sh launch_frontend.sh pocketshell-games pocketshell-play pocket-game-play pocketjs-native-launch > SHA256SUMS)
remote "mkdir '$device_stage'"
for name in boot.pocket pocket-linux-kms install.sh launch_frontend.sh pocketshell-games pocketshell-play pocket-game-play pocketjs-native-launch SHA256SUMS; do
    push "$local_stage/$name" "$device_stage/$name"
done
remote "cd '$device_stage' && sha256sum -c SHA256SUMS && chmod 0755 pocket-linux-kms && ./pocket-linux-kms --package '$device_stage/boot.pocket' --check"
if [ "$mode" = --check ]; then echo 'Runtime and package admitted; installed files unchanged.'; exit 0; fi

remote "sh '$device_stage/install.sh' '$device_stage'"
old_pids=$(remote 'pidof pocket-linux-kms || :')
[ -n "$old_pids" ] || { echo 'installation succeeded, but the launcher was not running' >&2; exit 1; }
remote 'pids=$(pidof pocket-linux-kms || :); [ -n "$pids" ] && kill -TERM $pids'
new_pids=
for attempt in $(seq 1 30); do
    sleep 1
    new_pids=$(remote 'pidof pocket-linux-kms || :')
    if [ -n "$new_pids" ] && [ "$new_pids" != "$old_pids" ]; then break; fi
done
[ -n "$new_pids" ] && [ "$new_pids" != "$old_pids" ] || { echo 'launcher restart not verified' >&2; exit 1; }
command_lines=$(remote 'for pid in $(pidof pocket-linux-kms); do tr "\\000" "\\n" < "/proc/$pid/cmdline"; done')
[[ "$command_lines" == *'/launcher/pocket-linux-kms'* && "$command_lines" == *'/apps/boot.pocket'* ]] || { echo 'active launcher runtime or package does not match the installation' >&2; exit 1; }
remote 'tail -n 8 /tmp/pocketjs-frontend.log'
pan=$(remote 'cat /sys/class/graphics/fb0/pan')
case "$pan" in 0,0) page=0 ;; 0,480) page=1 ;; *) echo "unexpected framebuffer pan: $pan" >&2; exit 1 ;; esac
remote "dd if=/dev/fb0 of='$device_stage/frame.raw' bs=4096 count=675 2>/dev/null"
mkdir -p "$repo/dist"
capture="$repo/dist/device-$(date +%Y%m%d-%H%M%S)-$$"
pull "$device_stage/frame.raw" "$capture.raw"
[ "$(wc -c < "$capture.raw")" -eq 2764800 ] || { echo 'framebuffer capture has unexpected size' >&2; exit 1; }
python3 "$repo/scripts/raw-to-png.py" "$capture.raw" "$capture.png" 720 480 32 "$page"
echo "Inspect $capture.png and verify handheld controls; backup location is printed above."
