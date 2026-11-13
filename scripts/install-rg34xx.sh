#!/bin/sh
set -eu

stage=${1:?missing staging directory}
root=${PJOS_DEPLOY_ROOT:-/storage/System}
backup="$root/pocketjs/backups/ui-$(date +%Y%m%d-%H%M%S)-$$"
files='pocketjs/bin/launcher/pocket-linux-kms
pocketjs/apps/boot.pocket
compat/bin/pocketshell-games
compat/bin/pocketshell-play
compat/bin/pocket-game-play
compat/bin/pocketjs-native-launch
launch_frontend.sh'

[ -d "$root/pocketjs/apps" ] && [ -f "$root/launch_frontend.sh" ] || { echo "PocketShell installation not found" >&2; exit 1; }
[ ! -s /run/baseos-foreground-app ] || { echo "A foreground app is active; return to the launcher first" >&2; exit 1; }
cd "$stage"
sha256sum -c SHA256SUMS
chmod 0755 pocket-linux-kms
./pocket-linux-kms --package "$stage/boot.pocket" --check
mkdir -p "$root/pocketjs/backups"
mkdir "$backup"
for relative in $files; do
    destination="$root/$relative"
    if [ -L "$destination" ] || { [ -e "$destination" ] && [ ! -f "$destination" ]; }; then
        echo "refusing non-regular destination: $destination" >&2
        exit 1
    fi
    if [ -f "$destination" ]; then
        mkdir -p "$(dirname "$backup/$relative")"
        cp -p "$destination" "$backup/$relative"
        cmp -s "$destination" "$backup/$relative"
    fi
done

committed=0
rollback() {
    [ "$committed" = 1 ] && return
    for relative in $files; do
        destination="$root/$relative"
        if [ -f "$backup/$relative" ]; then
            cp -p "$backup/$relative" "$destination"
        else
            rm -f "$destination"
        fi
        rm -f "$destination.pjos-new-$$"
    done
    sync
}
trap rollback EXIT

install_file() {
    source_file=$1
    relative=$2
    mode=$3
    destination="$root/$relative"
    mkdir -p "${destination%/*}"
    temporary="$destination.pjos-new-$$"
    [ ! -e "$temporary" ]
    cp "$stage/$source_file" "$temporary"
    chmod "$mode" "$temporary"
    cmp -s "$stage/$source_file" "$temporary"
    mv "$temporary" "$destination"
}

install_file pocket-linux-kms pocketjs/bin/launcher/pocket-linux-kms 0755
install_file pocketshell-games compat/bin/pocketshell-games 0755
install_file pocketshell-play compat/bin/pocketshell-play 0755
install_file pocket-game-play compat/bin/pocket-game-play 0755
install_file pocketjs-native-launch compat/bin/pocketjs-native-launch 0755
install_file launch_frontend.sh launch_frontend.sh 0755
install_file boot.pocket pocketjs/apps/boot.pocket 0644
"$root/pocketjs/bin/launcher/pocket-linux-kms" --package "$root/pocketjs/apps/boot.pocket" --check
sync
committed=1
trap - EXIT
printf 'Installed and verified. Backup: %s\n' "$backup"
