#!/bin/sh
# SPDX-FileCopyrightText: 2026 New Horizon Electronics
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Copies ./nhe to the MOD device and (re)installs the hooks. Run ON YOUR MAC:
#
#   tools/deploy.sh                 # Duo over USB (192.168.51.1)
#   tools/deploy.sh 192.168.1.50    # another address
#   tools/deploy.sh --patchbox [patchbox.local]
#                                   # a Raspberry Pi with Patchbox OS / MODEP
#
# Password for root on a MOD device is "mod". (Tip: `ssh-copy-id
# root@192.168.51.1` once, and you won't be asked again.)
#
# Patchbox: logs in as `patch` and uses sudo on the Pi (it asks for the
# patch user's password). MODEP keeps MOD's web folder (/usr/share/mod/html)
# and its data in /var/modep, so NHE goes to /var/modep/nhe.
set -e
cd "$(dirname "$0")/.."

PATCHBOX=0
if [ "$1" = "--patchbox" ]; then PATCHBOX=1; shift; fi
if [ "$PATCHBOX" = 1 ]; then HOST=${1:-patchbox.local}; else HOST=${1:-192.168.51.1}; fi

# a new version string makes every browser fetch the new files on reload
VERSION=$(git rev-parse --short HEAD 2>/dev/null || echo nogit)-$(date +%Y%m%d%H%M%S)
printf '{"version": "%s"}\n' "$VERSION" > nhe/version.json

if [ "$PATCHBOX" = 1 ]; then
    echo "Copying nhe/ ($VERSION) to patch@$HOST ..."
    # a leftover upload folder would get nhe/ copied inside it
    ssh "patch@$HOST" 'rm -rf ~/nhe-upload'
    scp -r nhe "patch@$HOST:~/nhe-upload"
    printf '{"version": "dev"}\n' > nhe/version.json
    echo "Installing to /var/modep/nhe and hooking into MODEP (sudo on the Pi) ..."
    ssh -t "patch@$HOST" 'sudo rm -rf /var/modep/nhe && sudo mv ~/nhe-upload /var/modep/nhe && sudo NHE_TEST_DATA=/var/modep/nhe NHE_TEST_BACKUP=/var/modep/nhe-backup sh /var/modep/nhe/device/install.sh'
    echo "Done. Reload http://$HOST (Cmd+Shift+R)."
    exit 0
fi

echo "Copying nhe/ ($VERSION) to root@$HOST:/data/nhe ..."
# -O: the MOD has no SFTP subsystem; macOS scp needs the legacy protocol
scp -O -r nhe "root@$HOST:/data/"

echo "Installing hooks ..."
ssh "root@$HOST" 'sh /data/nhe/device/install.sh'

printf '{"version": "dev"}\n' > nhe/version.json
echo "Done. Reload the MOD UI."
