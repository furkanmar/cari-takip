#!/usr/bin/env bash
# Pi üzerinde cron ile çalışır: GHCR'de yeni imaj varsa çeker ve sadece
# değişen container'ları yeniden başlatır. İmaj değişmediyse hiçbir şey olmaz.
#
# Kurulum (Pi):
#   crontab -e  →  */5 * * * * bash /home/<kullanici>/cari-takip/deploy/update.sh >> /tmp/cari-takip-deploy.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."

git pull --ff-only -q                      # compose dosyası değiştiyse onu da al
docker compose pull -q api frontend
docker compose up -d --remove-orphans      # sadece imajı değişenleri yeniden oluşturur
docker image prune -f >/dev/null           # eski imaj katmanlarını temizle
echo "$(date '+%F %T') ok $(docker inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' cari-takip-api 2>/dev/null)"
