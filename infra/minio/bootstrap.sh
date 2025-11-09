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
  uploader_access_key="${STORAGE_ACCESS_KEY:-}"
  uploader_secret_key="${STORAGE_SECRET_KEY:-}"

  if [ -n "$uploader_access_key" ] && [ -n "$uploader_secret_key" ]; then
    if [ "$uploader_access_key" = "$user" ]; then
      echo "[bootstrap] STORAGE_ACCESS_KEY matches MINIO_ROOT_USER; scoped uploader not created" >&2
    else
      if ! mc admin user info "$alias_name" "$uploader_access_key" >/dev/null 2>&1; then
        mc admin user add "$alias_name" "$uploader_access_key" "$uploader_secret_key" >/dev/null
      fi
      mc admin user enable "$alias_name" "$uploader_access_key" >/dev/null 2>&1 || true
      mc admin policy attach "$alias_name" treaz-uploader --user "$uploader_access_key" >/dev/null
      mc admin policy detach "$alias_name" treaz-uploader --user "$user" >/dev/null 2>&1 || true
      echo "Scoped uploader credentials ensured for $uploader_access_key"
    fi
  else
    echo "[bootstrap] STORAGE_ACCESS_KEY/STORAGE_SECRET_KEY not provided; skipping scoped uploader configuration" >&2
  fi
fi

echo "MinIO bootstrap complete."
