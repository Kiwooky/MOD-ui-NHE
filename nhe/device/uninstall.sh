#!/bin/sh
# SPDX-FileCopyrightText: 2026 New Horizon Electronics
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Removes the NHE hooks from MOD's web UI. Run ON THE MOD DEVICE:
#
#   sh /data/nhe/device/uninstall.sh
#
# Restores MOD's original index.html and removes the link. /data/nhe and the
# backup in /data/nhe-backup are left in place.
set -e

HTML=${NHE_TEST_HTML:-/usr/share/mod/html}
BACKUP=${NHE_TEST_BACKUP:-/data/nhe-backup}

remounted=0
if ! touch "$HTML/.nhe-rw-test" 2>/dev/null; then
    mount -o remount,rw /
    remounted=1
fi
rm -f "$HTML/.nhe-rw-test"
restore() { if [ "$remounted" = 1 ]; then sync; mount -o remount,ro /; fi; }
trap restore EXIT

if [ -f "$BACKUP/index.html.orig" ]; then
    cp "$BACKUP/index.html.orig" "$HTML/index.html"
else
    sed -i 's#<script[^>]*nhe/loader\.js[^>]*></script>##g' "$HTML/index.html"
fi
[ -L "$HTML/nhe" ] && rm "$HTML/nhe"
echo "NHE removed. Reload the MOD UI in your browser."
