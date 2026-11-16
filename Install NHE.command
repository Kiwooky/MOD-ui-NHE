#!/bin/sh
# SPDX-FileCopyrightText: 2026 New Horizon Electronics
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Installs NHE on a MOD (Duo, Duo X, Dwarf) running stock MOD OS 1.14 or newer.
# On a Mac: double-click this file. (First time: right-click > Open, then Open,
# since it was downloaded from the internet.) Linux: sh "Install NHE.command".
#
# It copies the nhe folder next to this file to the MOD and runs
# nhe/device/install.sh there: the same as tools/deploy.sh, without needing
# git or a terminal. You type the MOD's password once: mod
# To remove NHE again, run "Uninstall NHE.command".

cd "$(dirname "$0")" || exit 1

finish() {
    echo
    printf 'Press Return to close this window. '
    read -r _
    exit "$1"
}

echo "NHE installer for MOD"
echo "---------------------"

if [ ! -f nhe/loader.js ] || [ ! -f nhe/device/install.sh ]; then
    echo "Can't find the nhe folder next to this file."
    echo "Unzip the whole download first, then run the installer from inside that folder."
    finish 1
fi

echo
echo "Connect your MOD with its USB cable and wait until it has started."
printf 'MOD address [192.168.51.1]: '
read -r HOST
HOST=${HOST:-192.168.51.1}

if command -v curl >/dev/null 2>&1; then
    if ! curl -s -m 5 -o /dev/null "http://$HOST/"; then
        echo
        echo "Can't reach a MOD at http://$HOST/."
        echo "Check the USB cable (or the address), and that http://$HOST opens MOD's page in your browser."
        finish 1
    fi
fi

# a new version string makes browsers fetch the new files on reload
VERSION=install-$(date +%Y%m%d%H%M%S)
printf '{"version": "%s"}\n' "$VERSION" > nhe/version.json

echo
echo "Installing NHE ($VERSION) on $HOST."
echo "When asked for a password, type:  mod   (nothing shows while you type), then Return."
echo

# One connection, so one password. The files go over as a tar stream (the MOD
# has no SFTP, and this also works where scp differs). The MOD's key changes
# when its OS is reinstalled, so it isn't checked or remembered.
COPYFILE_DISABLE=1 tar --format=ustar -cf - -C nhe . | ssh \
    -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR \
    "root@$HOST" '
set -e
rm -rf /data/nhe.new /data/nhe.old
mkdir -p /data/nhe.new
tar -xf - -C /data/nhe.new
[ -f /data/nhe.new/device/install.sh ] || { echo "The copy did not arrive complete."; exit 1; }
[ -d /data/nhe ] && mv /data/nhe /data/nhe.old
mv /data/nhe.new /data/nhe
rm -rf /data/nhe.old
sh /data/nhe/device/install.sh
'
STATUS=$?

echo
if [ "$STATUS" -eq 0 ]; then
    echo "Done. Open (or reload) http://$HOST in your browser."
    echo "After a MOD OS update, run this installer again."
else
    echo "Something went wrong (see above). MOD's own page is backed up in /data/nhe-backup"
    echo "on the MOD, and \"Uninstall NHE\" puts it back."
fi
finish "$STATUS"
