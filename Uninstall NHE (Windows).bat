@echo off
rem SPDX-FileCopyrightText: 2026 New Horizon Electronics
rem SPDX-License-Identifier: AGPL-3.0-or-later
rem
rem Removes NHE from a MOD: puts MOD's original page back (nhe/device/uninstall.sh).
rem Double-click this file. You type the MOD's password once: mod

setlocal
title Remove NHE from your MOD
echo Remove NHE from your MOD
echo ------------------------
where ssh >nul 2>nul || (
    echo Windows' ssh is missing. Add it in Settings, System, Optional features: "OpenSSH Client".
    goto end
)
set "HOST=192.168.51.1"
set /p "HOST=MOD address [192.168.51.1]: "
echo When asked for a password, type:  mod   (nothing shows while you type), then Enter.
echo.
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=NUL -o LogLevel=ERROR root@%HOST% "if [ -f /data/nhe/device/uninstall.sh ]; then sh /data/nhe/device/uninstall.sh; else echo NHE is not installed on this MOD.; fi"
if errorlevel 1 goto end
echo.
echo Done. Reload http://%HOST% in your browser.

:end
echo.
pause
