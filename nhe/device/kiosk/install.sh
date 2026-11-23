#!/bin/sh
# SPDX-FileCopyrightText: 2026 New Horizon Electronics
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Turns a Raspberry Pi with Patchbox OS / MODEP into a touch-screen MOD: on
# boot, MOD's web UI opens full screen on the attached display (Chromium in
# kiosk mode, on a bare X server; no desktop). Run ON THE PI:
#
#   sudo sh /var/modep/nhe/device/kiosk/install.sh            # install / update
#   sudo sh /var/modep/nhe/device/kiosk/install.sh --remove   # take it away
#
# Needs the internet once (apt). Safe to run again. It:
#   - installs X, xinit, xrandr/xset and Chromium (no recommended extras)
#   - lets the Pi's user start X (Xwrapper.config) and use the display,
#     touch and keyboard (groups video, input, render, tty)
#   - writes /etc/default/nhe-kiosk (kept if it's there: your settings)
#   - adds and starts the nhe-kiosk service on the first console (tty1)
#
# MOD's UI expects one browser: while the kiosk shows it, opening
# http://patchbox.local from another computer can hang on "Loading
# pedalboard…". `sudo systemctl stop nhe-kiosk` frees it for a while.
set -e

[ "$(id -u)" = 0 ] || { echo "Run it with sudo."; exit 1; }
HERE=$(cd "$(dirname "$0")" && pwd)
KIOSK_USER=${KIOSK_USER:-${SUDO_USER:-patch}}
SERVICE=/etc/systemd/system/nhe-kiosk.service
CONF=/etc/default/nhe-kiosk

if [ "$1" = --remove ]; then
    systemctl disable --now nhe-kiosk 2>/dev/null || true
    rm -f "$SERVICE"
    systemctl daemon-reload
    systemctl start getty@tty1 2>/dev/null || true
    echo "Kiosk removed. $CONF and the installed packages stay (apt remove them if you like)."
    exit 0
fi

command -v apt-get >/dev/null || { echo "No apt-get: this is for Patchbox OS / Raspberry Pi OS."; exit 1; }
id "$KIOSK_USER" >/dev/null 2>&1 || { echo "No user $KIOSK_USER (set KIOSK_USER=...)."; exit 1; }

echo "Installing X and Chromium (a few minutes) ..."
apt-get update
CHROMIUM=chromium
apt-cache show chromium >/dev/null 2>&1 || CHROMIUM=chromium-browser
DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    xserver-xorg xserver-xorg-input-libinput xinit x11-xserver-utils \
    "$CHROMIUM" fonts-dejavu-core wget

# X started from a service, as a user, not from a console login
cat > /etc/X11/Xwrapper.config <<'EOF'
allowed_users=anybody
needs_root_rights=yes
EOF
usermod -aG video,input,render,tty "$KIOSK_USER" 2>/dev/null || usermod -aG video,input,tty "$KIOSK_USER"

if [ ! -f "$CONF" ]; then
    cat > "$CONF" <<'EOF'
# NHE kiosk settings (nhe/device/kiosk/session.sh). After a change:
#   sudo systemctl restart nhe-kiosk
#
# SCALE: how much larger to draw MOD's UI. auto works it out from the size
# the screen reports (5" 800x480 -> 1.25); if the screen reports a wrong
# size, set a number, e.g. SCALE=1.25. `journalctl -u nhe-kiosk` shows what
# auto chose.
SCALE=auto
# URL: the page to show
URL=http://localhost/
# X_ARGS: options for the X server. -nocursor hides the pointer (a touch
# screen); leave it empty to use a mouse.
X_ARGS=-nocursor
EOF
    echo "Wrote $CONF"
fi

cat > "$SERVICE" <<EOF
[Unit]
Description=NHE kiosk: MOD's web UI full screen on the attached display
After=systemd-user-sessions.service network.target
Conflicts=getty@tty1.service

[Service]
User=$KIOSK_USER
PAMName=login
TTYPath=/dev/tty1
StandardInput=tty
StandardOutput=journal
StandardError=journal
UtmpIdentifier=tty1
UtmpMode=user
Environment=X_ARGS=-nocursor
EnvironmentFile=-$CONF
ExecStart=/usr/bin/startx /bin/sh $HERE/session.sh -- vt1 -keeptty \$X_ARGS
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl disable getty@tty1 2>/dev/null || true
systemctl enable nhe-kiosk
systemctl restart nhe-kiosk
echo "Kiosk running. It starts on every boot. Settings: $CONF. Log: journalctl -u nhe-kiosk"
