#!/bin/sh
# SPDX-FileCopyrightText: 2026 Niels
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Hooks the NHE layer into MOD's web UI. Run ON THE MOD DEVICE:
#
#   sh /data/nhe/device/install.sh
#
# Safe to run again (after every deploy, or after a MOD OS update, which
# wipes these hooks). It:
#   - backs up MOD's original index.html to /data/nhe-backup/ (first run only)
#   - links /usr/share/mod/html/nhe -> /data/nhe (so later updates are just
#     file copies into /data/nhe, no remount needed)
#   - adds one <script> tag for nhe/loader.js to index.html
#   - removes the older one-file performance-inject.js tag, if present
# Takes effect on the next browser reload; no reboot needed.
set -e

HTML=${NHE_TEST_HTML:-/usr/share/mod/html}
DATA=${NHE_TEST_DATA:-/data/nhe}
BACKUP=${NHE_TEST_BACKUP:-/data/nhe-backup}
TAG='<script type="text/javascript" src="nhe/loader.js?v=1"></script>'

[ -f "$DATA/loader.js" ] || { echo "No $DATA/loader.js: copy the nhe folder to /data first."; exit 1; }

remounted=0
if ! touch "$HTML/.nhe-rw-test" 2>/dev/null; then
    mount -o remount,rw /
    remounted=1
fi
rm -f "$HTML/.nhe-rw-test"
restore() { if [ "$remounted" = 1 ]; then sync; mount -o remount,ro /; fi; }
trap restore EXIT

mkdir -p "$BACKUP"
if [ ! -f "$BACKUP/index.html.orig" ]; then
    # an earlier manual install kept its backup here; prefer that pristine copy
    if [ -f /data/index.html.orig ]; then
        cp /data/index.html.orig "$BACKUP/index.html.orig"
    else
        cp "$HTML/index.html" "$BACKUP/index.html.orig"
    fi
    echo "Backed up MOD's index.html to $BACKUP/index.html.orig"
fi

# link (replace a stale link, never a real folder)
if [ -L "$HTML/nhe" ] || [ ! -e "$HTML/nhe" ]; then
    ln -sfn "$DATA" "$HTML/nhe"
else
    echo "$HTML/nhe exists and is not a link; leaving it alone."; exit 1
fi

# remove the older one-file install, if any
sed -i 's#<script[^>]*performance-inject\.js[^>]*></script>##g' "$HTML/index.html"
rm -f "$HTML/js/performance-inject.js"

# add the loader tag once
if ! grep -q 'nhe/loader\.js' "$HTML/index.html"; then
    sed -i "s#</body>#$TAG</body>#" "$HTML/index.html"
fi
grep -q 'nhe/loader\.js' "$HTML/index.html" || { echo "Could not add the loader tag."; exit 1; }

echo "NHE installed. Reload the MOD UI in your browser."
