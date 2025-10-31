#!/usr/bin/env bash
set -euo pipefail

WEBROOT="/var/www/certbot"
CRON_FILE="/etc/cron.d/certbot-renew"
LOG_FILE="/var/log/certbot-renew.log"

: "${LETSENCRYPT_EMAIL?LETSENCRYPT_EMAIL must be set}"
: "${LETSENCRYPT_PRIMARY_DOMAIN?LETSENCRYPT_PRIMARY_DOMAIN must be set}"

IFS=',' read -ra ADDITIONAL <<< "${LETSENCRYPT_ADDITIONAL_DOMAINS:-}"
DOMAIN_ARGS="-d ${LETSENCRYPT_PRIMARY_DOMAIN}"
for domain in "${ADDITIONAL[@]}"; do
  trimmed=$(echo "$domain" | xargs)
  if [[ -n "$trimmed" ]]; then
    DOMAIN_ARGS+=" -d ${trimmed}"
  fi
done

if [[ "${LETSENCRYPT_STAGING:-false}" == "true" ]]; then
  STAGING_FLAG="--staging"
else
  STAGING_FLAG=""
fi

if [[ ! -d "/etc/letsencrypt/live/${LETSENCRYPT_PRIMARY_DOMAIN}" ]]; then
  echo "[certbot] requesting certificates for ${LETSENCRYPT_PRIMARY_DOMAIN}"
  certbot certonly --webroot -w "$WEBROOT" \
    --non-interactive --agree-tos --email "$LETSENCRYPT_EMAIL" \
    ${DOMAIN_ARGS} ${STAGING_FLAG}
else
  echo "[certbot] existing certificates found for ${LETSENCRYPT_PRIMARY_DOMAIN}, skipping initial issuance"
fi

echo "SHELL=/bin/sh" > "$CRON_FILE"
echo "0 3 * * 0 root certbot renew --webroot -w $WEBROOT --deploy-hook /usr/local/bin/reload-nginx.sh >> $LOG_FILE 2>&1" >> "$CRON_FILE"
chmod 0644 "$CRON_FILE"
crontab "$CRON_FILE"

touch "$LOG_FILE"

# Run an initial renewal attempt to ensure hooks succeed when containers are up.
certbot renew --dry-run --webroot -w "$WEBROOT" --deploy-hook /usr/local/bin/reload-nginx.sh || true

echo "[certbot] starting cron in foreground"
exec cron -f
