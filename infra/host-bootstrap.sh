#!/usr/bin/env bash
# Run once, as root, on a fresh Ubuntu 24.04 VM (07-OPS-ARCH 22.1).
# Usage: BASTION_IP=203.0.113.10 [DATA_DISK=/dev/sdb] [INFRA_DIR=.] ./host-bootstrap.sh
set -euo pipefail

: "${BASTION_IP:?BASTION_IP is required, because SSH must not be open to the internet}"
data_disk="${DATA_DISK:-/dev/sdb}"
infra_dir="${INFRA_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"

apt-get update
apt-get upgrade -y
apt-get install -y curl jq git ca-certificates gnupg openssl ufw fail2ban unattended-upgrades certbot

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
# shellcheck disable=SC1091
codename="$(. /etc/os-release && echo "${VERSION_CODENAME}")"
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${codename} stable" \
  >/etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# cosign verifies image signatures at deploy (07-OPS-ARCH 16.2).
cosign_version=v2.5.0
curl -fsSL -o /usr/local/bin/cosign \
  "https://github.com/sigstore/cosign/releases/download/${cosign_version}/cosign-linux-amd64"
chmod 755 /usr/local/bin/cosign

id deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash deploy
usermod -aG docker deploy

ufw default deny incoming
ufw default allow outgoing
ufw allow from "${BASTION_IP}" to any port 22 proto tcp comment 'SSH from bastion only'
ufw allow 80/tcp comment 'HTTP redirect to HTTPS'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable

sed -i -E 's/^#?PermitRootLogin.*/PermitRootLogin no/; s/^#?PasswordAuthentication.*/PasswordAuthentication no/' \
  /etc/ssh/sshd_config
systemctl reload ssh
systemctl enable --now fail2ban
dpkg-reconfigure -f noninteractive -plow unattended-upgrades
timedatectl set-timezone UTC

# Never format a disk that already holds a filesystem, or running this twice would destroy the data.
if [ -b "${data_disk}" ] && ! mountpoint -q /var/lib/cms; then
  if ! blkid "${data_disk}" >/dev/null 2>&1; then
    mkfs.ext4 "${data_disk}"
  fi
  mkdir -p /var/lib/cms
  grep -q "${data_disk} /var/lib/cms" /etc/fstab ||
    echo "${data_disk} /var/lib/cms ext4 defaults,nofail 0 2" >>/etc/fstab
  mount /var/lib/cms
fi

# Owners are the users inside each image, which differ from 07-OPS-ARCH 6.3 (ADR-0013).
install -d -m 755 -o root -g root /var/lib/cms
install -d -m 700 -o 70 -g 70 /var/lib/cms/postgres
install -d -m 700 -o 999 -g 1000 /var/lib/cms/redis
install -d -m 700 -o 1000 -g 1000 /var/lib/cms/object-storage
install -d -m 700 -o deploy -g deploy /var/lib/cms/backups
install -d -m 755 -o deploy -g deploy /opt/cms /opt/cms/releases /opt/cms/shared
install -d -m 700 -o deploy -g deploy /opt/cms/shared/env /opt/cms/shared/secrets
install -d -m 750 -o root -g 101 /etc/cms/tls
install -d -m 755 /var/www/certbot
install -d -m 755 /var/log/cms

install -m 644 "${infra_dir}"/systemd/* /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now cms-backup-postgres.timer cms-backup-daily.timer cms-audit-perms.timer

echo "Host bootstrap complete. Next: docs in infra/runbooks/README.md. A reboot is recommended."
