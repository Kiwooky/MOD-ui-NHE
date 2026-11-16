#!/bin/sh
# SPDX-FileCopyrightText: 2026 New Horizon Electronics
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Removes NHE from a MOD: puts MOD's original page back (nhe/device/uninstall.sh).
# On a Mac: double-click this file. You type the MOD's password once: mod

cd "$(dirname "$0")" || exit 1

finish() {
    echo
    printf 'Press Return to close this window. '
    read -r _
    exit "$1"
}

echo "Remove NHE from your MOD"
echo "------------------------"
printf 'MOD address [192.168.51.1]: '
read -r HOST
HOST=${HOST:-192.168.51.1}
echo "When asked for a password, type:  mod   (nothing shows while you type), then Return."
echo

ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR \
    "root@$HOST" '
if [ -f /data/nhe/device/uninstall.sh ]; then sh /data/nhe/device/uninstall.sh
else echo "NHE is not installed on this MOD."; fi
'
STATUS=$?
[ "$STATUS" -eq 0 ] && echo && echo "Done. Reload http://$HOST in your browser."
finish "$STATUS"
