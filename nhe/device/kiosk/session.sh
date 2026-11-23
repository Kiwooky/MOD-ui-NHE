#!/bin/sh
# SPDX-FileCopyrightText: 2026 New Horizon Electronics
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# The kiosk's X session on a Raspberry Pi with Patchbox OS / MODEP: MOD's
# web UI full screen in Chromium on the attached display. Started by the
# nhe-kiosk service (kiosk/install.sh), through startx, as the Pi's user.
# Settings: /etc/default/nhe-kiosk (written by kiosk/install.sh).
#
# Scale: a browser can't tell how big a screen is, so this works it out
# here and hands Chromium a device scale factor. X reports the panel's size
# in mm (from its EDID); from that and the resolution comes the screen's
# pixel density, and SCALE=auto turns that into a factor:
#   density / 150 dpi, between 1 and 1.5, in steps of 0.05, and never so
#   large that fewer than 380 px of height are left for MOD's page.
# 5" 800 x 480 (187 dpi) -> 1.25; 7" 800 x 480 (133 dpi) -> 1;
# 7" 1024 x 600 (170 dpi) -> 1.1. Many cheap HDMI panels report no size or a
# made-up one (it doesn't match their shape, or it's under 3" or over 40"):
# then 1. Set SCALE=1.25 (or any number) to choose it yourself.

CONF=/etc/default/nhe-kiosk
URL=http://localhost/
SCALE=auto
[ -r "$CONF" ] && . "$CONF"

log() { echo "[nhe-kiosk] $*"; }

# keep the screen on
xset s off 2>/dev/null
xset s noblank 2>/dev/null
xset -dpms 2>/dev/null

auto_scale() {
    xrandr --query 2>/dev/null | awk '
        / connected/ && !seen {
            seen = 1
            if (match($0, /[0-9]+x[0-9]+\+/)) { split(substr($0, RSTART, RLENGTH - 1), r, "x") }
            if (match($0, /[0-9]+mm x [0-9]+mm/)) { s = substr($0, RSTART, RLENGTH); gsub(/mm/, "", s); split(s, m, " x ") }
        }
        END {
            w = r[1] + 0; h = r[2] + 0; mw = m[1] + 0; mh = m[2] + 0
            if (!w || !h || !mw || !mh) { print "1 no-size"; exit }
            diag = sqrt(mw * mw + mh * mh) / 25.4
            ratio = (w / h) / (mw / mh)
            if (diag < 3 || diag > 40 || ratio > 1.15 || ratio < 1 / 1.15) { print "1 size-looks-wrong"; exit }
            dpi = w / (mw / 25.4)
            s = dpi / 150
            if (s > 1.5) s = 1.5
            if (h / s < 380) s = h / 380
            if (s < 1) s = 1
            s = int(s * 20) / 20
            printf "%.2f %dx%d,%.1fin,%ddpi\n", s, w, h, diag, dpi
        }'
}

if [ "$SCALE" = auto ]; then
    set -- $(auto_scale)
    SCALE=${1:-1}
    log "scale $SCALE (auto: ${2:-unknown})"
else
    log "scale $SCALE (set in $CONF)"
fi

# MOD's web UI comes up after the desktop on boot: wait for it
until wget -q -O /dev/null "$URL" 2>/dev/null || curl -fs -o /dev/null "$URL" 2>/dev/null; do
    log "waiting for $URL"
    sleep 2
done

BROWSER=$(command -v chromium || command -v chromium-browser)
[ -n "$BROWSER" ] || { log "no chromium installed (run kiosk/install.sh again)"; sleep 30; exit 1; }

# a browser that was switched off mid-session asks to restore its tabs: it didn't crash
PROFILE=$HOME/.config/nhe-kiosk
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"[^"]*"/"exit_type":"Normal"/' \
    "$PROFILE/Default/Preferences" 2>/dev/null

exec "$BROWSER" \
    --kiosk --start-fullscreen --window-position=0,0 \
    --user-data-dir="$PROFILE" \
    --force-device-scale-factor="$SCALE" \
    --touch-events=enabled --disable-pinch --overscroll-history-navigation=0 \
    --noerrdialogs --disable-infobars --disable-session-crashed-bubble \
    --disable-features=Translate,TouchpadOverscrollHistoryNavigation \
    --check-for-update-interval=31536000 --password-store=basic \
    "$URL"
