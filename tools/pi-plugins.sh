#!/bin/sh
# SPDX-FileCopyrightText: 2026 New Horizon Electronics
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Builds every NHE plugin ON a Raspberry Pi with Patchbox OS / MODEP and
# installs it into MODEP. Run it on the Mac, from this repo:
#
#   tools/pi-plugins.sh [patchbox.local]        # build and install all
#   tools/pi-plugins.sh --pack                  # only make the source pack (no Pi)
#   PLUGINS="NHE-Ouraverb NHE-EC280" tools/pi-plugins.sh   # just these repos
#
# It takes the plugin repos next to this one (../NHE-*/ with a bundle/
# folder), packs their source (DPF included; the three without their own
# DPF get a copy of Ouraverb's), copies the pack to the Pi, and there:
#   - installs the compiler (build-essential) once
#   - builds each bundle in bundle/ natively (any Pi, 32- or 64-bit)
#   - copies the .lv2 bundles into MODEP's plugin folder (from its
#     services' LV2_PATH; /var/modep/lv2 if none is set)
#   - restarts MODEP so the plugins show up
#
# Logs in as `patch` and uses sudo on the Pi (it asks for the password).
# Safe to run again: each bundle is replaced by the new build.
set -e

HERE=$(cd "$(dirname "$0")/.." && pwd)
SRC=$(cd "$HERE/.." && pwd)
PACK_ONLY=0
if [ "$1" = "--pack" ]; then PACK_ONLY=1; shift; fi
HOST=${1:-patchbox.local}

# ---- the repos -----------------------------------------------------------
if [ -z "$PLUGINS" ]; then
    PLUGINS=$(cd "$SRC" && for d in NHE-*; do ls "$d"/bundle/*.lv2 >/dev/null 2>&1 && [ -d "$d/plugins" ] && echo "$d"; done; true)
fi
[ -n "$PLUGINS" ] || { echo "No plugin repos found next to $HERE."; exit 1; }
DPF_FALLBACK=""
for d in NHE-Ouraverb $PLUGINS; do
    if [ -f "$SRC/$d/dpf/Makefile.plugins.mk" ]; then DPF_FALLBACK="$SRC/$d/dpf"; break; fi
done
[ -n "$DPF_FALLBACK" ] || { echo "No checked-out DPF in any repo (git submodule update --init)."; exit 1; }

# ---- the pack -------------------------------------------------------------
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
mkdir "$STAGE/nhe-plugins"
for d in $PLUGINS; do
    [ -d "$SRC/$d" ] || { echo "No $SRC/$d"; exit 1; }
    echo "Packing $d"
    rsync -a --exclude .git --exclude bin --exclude build --exclude dist --exclude tests \
        --exclude docs --exclude mod-plugin-builder --exclude node_modules --exclude '*.o' \
        "$SRC/$d/" "$STAGE/nhe-plugins/$d/"
    if [ ! -f "$STAGE/nhe-plugins/$d/dpf/Makefile.plugins.mk" ]; then
        rm -rf "$STAGE/nhe-plugins/$d/dpf"
        rsync -a --exclude .git "$DPF_FALLBACK/" "$STAGE/nhe-plugins/$d/dpf/"
    fi
done

# the build, run on the Pi
cat > "$STAGE/nhe-plugins/build.sh" <<'EOF'
#!/bin/sh
# builds every bundle here into ./out (no root needed)
cd "$(dirname "$0")"
rm -rf out; mkdir out
JOBS=$(nproc 2>/dev/null || echo 2)
OK=""; FAILED=""
for d in */; do
    d=${d%/}
    [ -d "$d/bundle" ] || continue
    for b in "$d"/bundle/*.lv2; do
        name=$(basename "$b" .lv2)
        echo "=== $name"
        if [ -f "$d/Makefile" ]; then
            ( cd "$d" && make -j"$JOBS" NAME="$name" ) > "out/$name.log" 2>&1
        elif [ -d "$d/plugins/$name" ]; then
            # no top-level Makefile: DPF builds bin/<name>.lv2, the bundle's face and files go over it
            ( cd "$d" && make -j"$JOBS" -C "plugins/$name" && cp -r "bundle/$name.lv2/." "bin/$name.lv2/" ) > "out/$name.log" 2>&1
        else
            echo "no way to build $name" > "out/$name.log"; false
        fi
        if [ $? = 0 ] && ls "$d/bin/$name.lv2/"*.so "$d/bin/$name.lv2/"*.dylib 2>/dev/null | grep -q .; then
            cp -r "$d/bin/$name.lv2" out/
            OK="$OK $name"
        else
            FAILED="$FAILED $name"
            tail -15 "out/$name.log"
        fi
    done
done
echo
echo "Built:$OK"
[ -z "$FAILED" ] || echo "FAILED:$FAILED (logs in $(pwd)/out)"
EOF

# the install, run on the Pi with sudo
cat > "$STAGE/nhe-plugins/install.sh" <<'EOF'
#!/bin/sh
# copies ./out/*.lv2 into MODEP's plugin folder and restarts MODEP (run with sudo)
set -e
cd "$(dirname "$0")"
ls out/*.lv2 >/dev/null 2>&1 || { echo "Nothing built."; exit 1; }
DEST=""
for s in modep-mod-host modep-mod-ui; do
    p=$(systemctl show -p Environment "$s" 2>/dev/null | tr ' ' '\n' | sed -n 's/^LV2_PATH=//p' | head -1)
    [ -n "$p" ] && { DEST=$(echo "$p" | cut -d: -f1); break; }
done
[ -n "$DEST" ] || DEST=/var/modep/lv2
echo "MODEP's plugin folder: $DEST ($(ls -d "$DEST"/*.lv2 2>/dev/null | wc -l) bundles there before)"
mkdir -p "$DEST"
OWNER=$(stat -c %U:%G "$DEST")
for b in out/*.lv2; do
    n=$(basename "$b")
    rm -rf "$DEST/$n"
    cp -r "$b" "$DEST/$n"
    chown -R "$OWNER" "$DEST/$n"
    echo "  installed $n"
done
for s in modep-mod-host modep-mod-ui; do systemctl try-restart "$s" 2>/dev/null || true; done
echo "MODEP restarted. Reload the page to see the plugins."
EOF
chmod +x "$STAGE/nhe-plugins/build.sh" "$STAGE/nhe-plugins/install.sh"

TAR="$STAGE/nhe-plugins.tar.gz"
COPYFILE_DISABLE=1 tar -czf "$TAR" -C "$STAGE" nhe-plugins
echo "Pack: $(du -h "$TAR" | cut -f1), $(echo $PLUGINS | wc -w | tr -d ' ') repos"

if [ "$PACK_ONLY" = 1 ]; then
    cp "$TAR" "$HERE/nhe-plugins.tar.gz"
    echo "Wrote $HERE/nhe-plugins.tar.gz (copy it to the Pi, untar, run nhe-plugins/build.sh, then sudo nhe-plugins/install.sh)"
    exit 0
fi

# ---- on the Pi -------------------------------------------------------------
echo "Copying to patch@$HOST ..."
scp -O "$TAR" "patch@$HOST:nhe-plugins.tar.gz"
echo "Building on the Pi (a few minutes the first time) ..."
ssh -t "patch@$HOST" 'set -e
    command -v g++ >/dev/null && command -v make >/dev/null || { sudo apt-get update && sudo apt-get install -y --no-install-recommends build-essential; }
    rm -rf ~/nhe-plugins && tar -xzf ~/nhe-plugins.tar.gz -C ~ && rm ~/nhe-plugins.tar.gz
    sh ~/nhe-plugins/build.sh
    sudo sh ~/nhe-plugins/install.sh'
