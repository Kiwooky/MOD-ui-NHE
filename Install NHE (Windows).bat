@echo off
rem SPDX-FileCopyrightText: 2026 New Horizon Electronics
rem SPDX-License-Identifier: AGPL-3.0-or-later
rem
rem Installs NHE on a MOD (Duo, Duo X, Dwarf) running stock MOD OS 1.14 or newer.
rem Windows 10 or 11: double-click this file. It uses the ssh and tar that come
rem with Windows. It copies the nhe folder next to this file to the MOD and runs
rem nhe/device/install.sh there. You type the MOD's password once: mod
rem To remove NHE again, run "Uninstall NHE (Windows).bat".

setlocal
cd /d "%~dp0"
title NHE installer for MOD
echo NHE installer for MOD
echo ---------------------

if not exist "nhe\loader.js" goto nofolder
if not exist "nhe\device\install.sh" goto nofolder
where ssh >nul 2>nul || goto nossh
where tar >nul 2>nul || goto notar

echo.
echo Connect your MOD with its USB cable and wait until it has started.
set "HOST=192.168.51.1"
set /p "HOST=MOD address [192.168.51.1]: "

where curl >nul 2>nul && (
    curl -s -m 5 -o NUL "http://%HOST%/" || goto noreach
)

rem a new version string makes browsers fetch the new files on reload
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMddHHmmss"') do set "STAMP=%%i"
set "VERSION=install-%STAMP%"
> "nhe\version.json" echo {"version": "%VERSION%"}

echo.
echo Installing NHE (%VERSION%) on %HOST%.
echo When asked for a password, type:  mod   (nothing shows while you type), then Enter.
echo.

rem One connection, so one password. The MOD's key changes when its OS is
rem reinstalled, so it isn't checked or remembered.
tar --format=ustar -cf - -C nhe . | ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=NUL -o LogLevel=ERROR root@%HOST% "set -e; rm -rf /data/nhe.new /data/nhe.old; mkdir -p /data/nhe.new; tar -xf - -C /data/nhe.new; test -f /data/nhe.new/device/install.sh; if [ -d /data/nhe ]; then mv /data/nhe /data/nhe.old; fi; mv /data/nhe.new /data/nhe; rm -rf /data/nhe.old; sh /data/nhe/device/install.sh"
if errorlevel 1 goto failed

echo.
echo Done. Open (or reload) http://%HOST% in your browser.
echo After a MOD OS update, run this installer again.
goto end

:failed
echo.
echo Something went wrong (see above). MOD's own page is backed up in /data/nhe-backup
echo on the MOD, and "Uninstall NHE (Windows).bat" puts it back.
goto end

:nofolder
echo Can't find the nhe folder next to this file.
echo Unzip the whole download first ("Extract all"), then run the installer from inside that folder.
goto end

:nossh
echo Windows' ssh is missing. Add it in Settings, System, Optional features: "OpenSSH Client".
goto end

:notar
echo Windows' tar is missing: this needs Windows 10 (April 2018 update) or newer.
goto end

:noreach
echo.
echo Can't reach a MOD at http://%HOST%/.
echo Check the USB cable (or the address), and that http://%HOST% opens MOD's page in your browser.
goto end

:end
echo.
pause
