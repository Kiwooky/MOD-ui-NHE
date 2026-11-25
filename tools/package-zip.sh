#!/bin/sh
# SPDX-FileCopyrightText: 2026 New Horizon Electronics
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Builds a zip for Starless's "User interfaces (EXPERIMENTAL)" installer
# (Settings > Developer on a MOD running Starless 19 or newer). Run ON YOUR MAC:
#
#   sh tools/package-zip.sh                         # Starless's own UI (sejerpz/mod-ui, branch starless)
#   sh tools/package-zip.sh --ref devel             # another branch or tag of that repo
#   sh tools/package-zip.sh --repo mod-audio/mod-ui --ref v1.14.0.3370
#   sh tools/package-zip.sh --html ../mod-ui/html   # a html/ folder you already have
#   sh tools/package-zip.sh -o ~/Desktop/nhe.zip    # where to write it (default: dist/)
#
# Starless installs a *whole* web UI: a complete html/ folder. NHE is a layer on
# top of MOD's UI, so the zip is MOD's html/ (taken from --repo/--ref or --html)
# with ./nhe inside it and one <script> tag in index.html, exactly as
# nhe/device/install.sh does on a stock MOD. Nothing here touches a device.
#
# The html/ must match the firmware the zip goes on (its templates are rendered
# by the MOD's server): for Starless, use Starless's mod-ui. Rebuild the zip
# when Starless updates its UI.
#
# Needs curl, unzip and zip (all on macOS by default).
set -e
cd "$(dirname "$0")/.."
ROOT=$(pwd)

REPO=sejerpz/mod-ui
REF=starless
HTML_SRC=
OUT=

while [ $# -gt 0 ]; do
    case "$1" in
        --repo) REPO=$2; shift 2 ;;
        --ref)  REF=$2;  shift 2 ;;
        --html) HTML_SRC=$2; shift 2 ;;
        -o|--out) OUT=$2; shift 2 ;;
        -h|--help) sed -n '5,22p' "$0"; exit 0 ;;
        *) echo "Unknown option: $1 (see --help)"; exit 1 ;;
    esac
done

for tool in unzip zip; do
    command -v $tool >/dev/null || { echo "Needs $tool."; exit 1; }
done

TMP=$(mktemp -d "${TMPDIR:-/tmp}/nhe-zip.XXXXXX")
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/src" "$TMP/out"

# 1. MOD's html/
if [ -n "$HTML_SRC" ]; then
    [ -f "$HTML_SRC/index.html" ] || { echo "No index.html in $HTML_SRC"; exit 1; }
    cp -R "$HTML_SRC" "$TMP/out/html"
    SOURCE="local folder $HTML_SRC"
else
    command -v curl >/dev/null || { echo "Needs curl."; exit 1; }
    URL="https://github.com/$REPO/archive/$REF.zip"
    echo "Downloading MOD's UI: $URL"
    curl -fsSL "$URL" -o "$TMP/src.zip" || { echo "Could not download $URL (check --repo and --ref)."; exit 1; }
    # GitHub puts the commit hash in the archive's comment
    COMMIT=$(unzip -z "$TMP/src.zip" | grep -Eo '[0-9a-f]{40}' | head -1)
    unzip -q "$TMP/src.zip" -d "$TMP/src"
    INDEX=$(cd "$TMP/src" && find . -path '*/html/index.html' | awk '{ print length, $0 }' | sort -n | head -1 | cut -d' ' -f2-)
    [ -n "$INDEX" ] || { echo "No html/index.html in $REPO@$REF."; exit 1; }
    cp -R "$TMP/src/$(dirname "$INDEX")" "$TMP/out/html"
    SOURCE="github.com/$REPO @ $REF${COMMIT:+ ($COMMIT)}"
fi
HTML="$TMP/out/html"
rm -rf "$HTML/nhe"

# 2. NHE inside it (the device scripts only make sense on a stock install)
# NHE_VERSION (e.g. a release tag) names this build; otherwise commit + time
VERSION=${NHE_VERSION:-$(git rev-parse --short HEAD 2>/dev/null || echo nogit)-$(date +%Y%m%d%H%M%S)}
VERSION=$(printf %s "$VERSION" | tr -cd 'A-Za-z0-9._-')
mkdir -p "$HTML/nhe"
(cd nhe && tar -cf - --exclude ./device --exclude .DS_Store .) | (cd "$HTML/nhe" && tar -xf -)
printf '{"version": "%s"}\n' "$VERSION" > "$HTML/nhe/version.json"
printf 'NHE %s\nBuilt %s on MOD UI from %s\nhttps://github.com/Kiwooky/MOD-ui-NHE\n' \
    "$VERSION" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$SOURCE" > "$HTML/nhe/BUILD.txt"

# 3. the loader tag, as install.sh adds it (sed to a new file: macOS and Linux sed -i differ)
TAG='<script type="text/javascript" src="nhe/loader.js?v='"$VERSION"'"></script>'
if grep -q 'nhe/loader\.js' "$HTML/index.html"; then
    sed "s#<script[^>]*nhe/loader\.js[^>]*></script>#$TAG#" "$HTML/index.html" > "$TMP/index.html"
else
    sed "s#</body>#$TAG</body>#" "$HTML/index.html" > "$TMP/index.html"
fi
grep -q 'nhe/loader\.js' "$TMP/index.html" || { echo "Could not add the loader tag (no </body> in index.html?)."; exit 1; }
# and the boot stylesheet in <head> (MOD's page hidden until NHE has started)
BOOT='<link rel="stylesheet" type="text/css" href="nhe/boot.css?v='"$VERSION"'">'
if grep -q 'nhe/boot\.css' "$TMP/index.html"; then
    sed "s#<link[^>]*nhe/boot\.css[^>]*>#$BOOT#" "$TMP/index.html" > "$TMP/index2.html"
else
    sed "s#</head>#$BOOT</head>#" "$TMP/index.html" > "$TMP/index2.html"
fi
cat "$TMP/index2.html" > "$HTML/index.html"

# 4. the zip: html/ at its top, which Starless's installer looks for
FILES=$(find "$HTML" -type f | wc -l | tr -d ' ')
BYTES=$(du -sk "$HTML" | cut -f1)
[ "$FILES" -le 5000 ] || echo "Warning: $FILES files; Starless accepts at most 5000."
[ "$BYTES" -le 51200 ] || echo "Warning: ${BYTES} KB unpacked; Starless accepts at most 50 MB."

[ -n "$OUT" ] || { mkdir -p dist; OUT="dist/nhe-$VERSION.zip"; }
case "$OUT" in /*) ;; *) OUT="$ROOT/$OUT" ;; esac
rm -f "$OUT"
(cd "$TMP/out" && zip -qr -X "$OUT" html -x '*.DS_Store')

echo "Built $OUT"
echo "  NHE $VERSION on MOD UI from $SOURCE ($FILES files)"
echo "Install: MOD web UI > Settings > Developer > User interfaces, name it e.g. nhe,"
echo "choose this zip (don't unpack it), Install, then pick nhe in the list."
