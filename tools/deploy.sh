#!/bin/sh
# SPDX-FileCopyrightText: 2026 Niels
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Copies ./nhe to the MOD device and (re)installs the hooks. Run ON YOUR MAC:
#
#   tools/deploy.sh                 # Duo over USB (192.168.51.1)
#   tools/deploy.sh 192.168.1.50    # another address
#
# Password for root on a MOD device is "mod". (Tip: `ssh-copy-id
# root@192.168.51.1` once, and you won't be asked again.)
set -e
cd "$(dirname "$0")/.."

HOST=${1:-192.168.51.1}

# a new version string makes every browser fetch the new files on reload
VERSION=$(git rev-parse --short HEAD 2>/dev/null || echo nogit)-$(date +%Y%m%d%H%M%S)
printf '{"version": "%s"}\n' "$VERSION" > nhe/version.json

echo "Copying nhe/ ($VERSION) to root@$HOST:/data/nhe ..."
# -O: the MOD has no SFTP subsystem; macOS scp needs the legacy protocol
scp -O -r nhe "root@$HOST:/data/"

echo "Installing hooks ..."
ssh "root@$HOST" 'sh /data/nhe/device/install.sh'

printf '{"version": "dev"}\n' > nhe/version.json
echo "Done. Reload the MOD UI."
