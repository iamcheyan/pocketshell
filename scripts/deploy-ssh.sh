#!/usr/bin/env bash
# Deploy the launcher package over SSH instead of ADB.
#
# Same steps as deploy.sh — admission check, timestamped backup, atomic install,
# frontend restart, framebuffer capture — but the transport is the handheld's own
# dropbear, so this works when USB ADB is absent (headless, on Wi-Fi, or when the
# gadget is in storage mode). Credentials come from the environment so the
# password never lands in the script: HANDHELD_HOST / HANDHELD_PASSWORD.
#
#   HANDHELD_HOST=192.168.3.57 HANDHELD_PASSWORD=… scripts/deploy-ssh.sh
set -euo pipefail

REPO=$(cd "$(dirname "$0")/.." && pwd)
PKG=${1:-$REPO/dist/pocketshell.pocket}
HOST_NAME=${HANDHELD_HOST:-192.168.3.57}
PASSWORD=${HANDHELD_PASSWORD:-}
APPS=/storage/System/pocketjs/apps
RUNTIME=/storage/System/pocketjs/bin/pocket-linux-kms
STAMP=$(date +%Y%m%d-%H%M%S)

[ -f "$PKG" ] || { echo "deploy-ssh: no package at $PKG (run make build)" >&2; exit 1; }
[ -n "$PASSWORD" ] || { echo "deploy-ssh: set HANDHELD_PASSWORD" >&2; exit 1; }

# sshpass is not installed on every host, so the password goes through a pty.
remote() {
	python3 - "$PASSWORD" "$HOST_NAME" "$1" <<'PY'
import os, pty, select, sys
password, host, command = sys.argv[1], sys.argv[2], sys.argv[3]
pid, fd = pty.fork()
if pid == 0:
    os.execvp("ssh", ["ssh", "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=10",
                      f"root@{host}", command])
sent = False
while True:
    try:
        ready, _, _ = select.select([fd], [], [], 60)
        if not ready:
            break
        chunk = os.read(fd, 4096)
    except OSError:
        break
    if not chunk:
        break
    text = chunk.decode(errors="replace")
    # The password prompt and ssh's banner go to stderr: callers capture stdout
    # (pidof, sha256sum) and a prompt in that stream breaks their commands.
    for line in text.splitlines(keepends=True):
        if "assword:" in line or "WARNING:" in line or "vulnerable" in line or "upgraded" in line or line.strip() == "**":
            sys.stderr.write(line)
        else:
            sys.stdout.write(line)
    sys.stdout.flush()
    if not sent and "assword:" in text:
        os.write(fd, (password + "\n").encode())
        sent = True
os.waitpid(pid, 0)
PY
}

copy() {
	python3 - "$PASSWORD" "$HOST_NAME" "$1" "$2" <<'PY'
import os, pty, select, sys
password, host, source, target = sys.argv[1:5]
# ":<path>" is remote: the colon keeps the direction explicit instead of
# guessing from the path shape.
download = source.startswith(":")
if download:
    source = source[1:]
pid, fd = pty.fork()
if pid == 0:
    base = ["scp", "-O", "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=10"]
    argv = base + ([f"root@{host}:{source}", target] if download else [source, f"root@{host}:{target}"])
    os.execvp("scp", argv)
sent = False
while True:
    try:
        ready, _, _ = select.select([fd], [], [], 120)
        if not ready:
            break
        chunk = os.read(fd, 4096)
    except OSError:
        break
    if not chunk:
        break
    text = chunk.decode(errors="replace")
    for line in text.splitlines(keepends=True):
        if ("assword:" in line or "WARNING:" in line or "vulnerable" in line
                or "upgraded" in line or line.strip() == "**"):
            sys.stderr.write(line)
        else:
            sys.stdout.write(line)
    sys.stdout.flush()
    if not sent and "assword:" in text:
        os.write(fd, (password + "\n").encode())
        sent = True
os.waitpid(pid, 0)
PY
}

SHA=$(sha256sum "$PKG" | cut -d' ' -f1)
echo "deploy-ssh: $PKG  $(stat -c%s "$PKG") bytes  sha256 $SHA  -> $HOST_NAME"

echo "== 1/5 admission check"
copy "$PKG" /storage/pjs/deploy.pocket
remote "$RUNTIME --package /storage/pjs/deploy.pocket --check"

echo "== 2/5 backup installed package"
remote "cd $APPS && cp -f boot.pocket boot.pocket.bak-$STAMP && ls -l boot.pocket boot.pocket.bak-$STAMP"

echo "== 3/5 install"
remote "cp -f /storage/pjs/deploy.pocket $APPS/boot.pocket && sync && sha256sum $APPS/boot.pocket"

echo "== 4/5 restart frontend"
OLD_PID=$(remote "pidof pocket-linux-kms || true" | tr -d '\r\n')
remote "kill -9 $OLD_PID 2>/dev/null || true"
sleep 8
remote "pidof pocket-linux-kms || true"

echo "== 5/5 frame"
# Read the framebuffer into a file on the device, then scp it: piping the raw
# device through the ssh pty mixes the password prompt into the pixel stream.
remote "cat /dev/fb0 > /tmp/frame-after-deploy.raw"
copy ":/tmp/frame-after-deploy.raw" "$REPO/dist/frame-after-deploy.raw"
python3 "$REPO/scripts/raw-to-png.py" "$REPO/dist/frame-after-deploy.raw" \
	"$REPO/dist/frame-after-deploy.png" 720 480 || true
remote "tail -6 /tmp/pocketjs-frontend.log"

echo "done. rollback: ssh root@$HOST_NAME 'cp -f $APPS/boot.pocket.bak-$STAMP $APPS/boot.pocket && kill -9 \$(pidof pocket-linux-kms)'"
