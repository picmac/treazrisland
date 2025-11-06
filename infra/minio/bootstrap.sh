#!/usr/bin/env sh
set -euo pipefail

alias_name="treaz"
endpoint="http://minio:9000"
user="${MINIO_ROOT_USER:?MINIO_ROOT_USER is required}"
password="${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD is required}"
assets_bucket="${STORAGE_BUCKET_ASSETS:-treaz-assets}"
roms_bucket="${STORAGE_BUCKET_ROMS:-treaz-roms}"
bios_bucket="${STORAGE_BUCKET_BIOS:-treaz-bios}"

mc alias set "$alias_name" "$endpoint" "$user" "$password"

for bucket in "$assets_bucket" "$roms_bucket" "$bios_bucket"; do
  mc mb --ignore-existing "$alias_name/$bucket"
  if [ -f "/bootstrap/lifecycle/uploads-retention.json" ] && \
     { [ "$bucket" = "$roms_bucket" ] || [ "$bucket" = "$assets_bucket" ]; }; then
    mc ilm import --json-file /bootstrap/lifecycle/uploads-retention.json "$alias_name/$bucket"
  fi
  mc anonymous set download "$alias_name/$bucket" >/dev/null 2>&1 || true
  echo "Ensured bucket $bucket exists"
done

if [ -f /bootstrap/policies/treaz-uploader.json ]; then
  mc admin policy create "$alias_name" treaz-uploader /bootstrap/policies/treaz-uploader.json >/dev/null 2>&1 || \
    mc admin policy update "$alias_name" treaz-uploader /bootstrap/policies/treaz-uploader.json >/dev/null
  mc admin policy attach "$alias_name" treaz-uploader --user "$user" >/dev/null
fi

echo "MinIO bootstrap complete."
