# Nginx + Let's Encrypt deployment guide

This document describes how to run the TREAZRISLAND frontend and backend behind Nginx with automated Let's Encrypt certificates using the `infra/docker-compose.yml` stack.

## Prerequisites

1. **DNS records**
   - Create `A` (and `AAAA` if using IPv6) records for each hostname that should terminate at the proxy.
   - Point the records to the public IP address of the host where Docker Compose runs.
   - Propagate both the primary domain and any alternates (e.g., apex + `www`).
2. **Firewall**
   - Allow inbound TCP traffic on ports `80` and `443` to reach the host.
3. **Docker host requirements**
   - Docker Engine 24+ and Docker Compose Plugin 2.20+.
   - Permission for containers to access `/var/run/docker.sock` (required so Certbot can signal Nginx to reload after renewals).

## Environment variables

Populate the following keys (see `.env.example` for defaults) in an `.env` file next to `infra/docker-compose.yml` or export them in your shell before running Compose:

| Variable | Description |
| --- | --- |
| `NGINX_SERVER_NAME` | Space-separated server names served by Nginx (e.g., `treazrisland.example.com www.treazrisland.example.com`). |
| `LETSENCRYPT_PRIMARY_DOMAIN` | Primary domain used for certificate storage under `/etc/letsencrypt/live/`. Usually matches the apex/primary host. |
| `LETSENCRYPT_ADDITIONAL_DOMAINS` | Comma-separated list of Subject Alternative Names to request with the same certificate. Leave empty if none. |
| `LETSENCRYPT_EMAIL` | Email address used for ACME registration and expiry alerts. |
| `LETSENCRYPT_STAGING` | Set to `true` while testing to avoid Let's Encrypt production rate limits. Flip to `false` for live certificates. |
| `NGINX_CONTAINER_NAME` | (Optional) Override when the Nginx container name is customized; defaults to `treazrisland-nginx`. |

## One-time bootstrap

1. Copy `.env.example` to `.env` and customise the values above.
2. Ensure the frontend and backend `.env.docker` files are configured for production URLs (not localhost) if serving real traffic.
3. Start the stack and tail the logs:
   ```bash
   docker compose --project-directory infra up -d postgres minio
   docker compose --project-directory infra up -d backend frontend
   docker compose --project-directory infra up -d nginx certbot
   docker compose --project-directory infra logs -f certbot nginx
   ```
4. Wait for the Certbot container to report `requested certificates` and for Nginx to serve HTTPS. The first run uses the ACME HTTP-01 challenge via the shared `/var/www/certbot` volume.
5. Visit `https://<your-domain>` and confirm the frontend loads. Visit `https://<your-domain>/api/health` to confirm backend health responses flow through the proxy.

## Automated renewals

- The Certbot companion installs a weekly cron job (`0 3 * * 0`) that runs `certbot renew --webroot`.
- On successful renewal, the deploy hook calls `reload-nginx.sh`, which triggers a `HUP` signal on the Nginx container via the Docker Engine API.
- Renewal logs are written to `/var/log/certbot-renew.log` inside the Certbot container and can be tailed with `docker compose --project-directory infra logs -f certbot`.

## Operational tips

- Set `LETSENCRYPT_STAGING=true` during dry runs; once validation succeeds, redeploy with `false` to request production certificates.
- If you rotate domains, run `docker compose --project-directory infra restart certbot` to request the new SAN set.
- Certbot shares `/etc/letsencrypt` with Nginx. Back up this volume regularly to preserve private keys.
- The Certbot container requires access to `/var/run/docker.sock`. Restrict host access accordingly and consider using a Docker socket proxy in hardened environments.

## Smoke testing

A helper script validates the proxy once all services are running:

```bash
./scripts/smoke/nginx-proxy.sh
```

The script expects the stack to be reachable on `http://localhost` (plain HTTP is redirected to HTTPS when certificates exist). It verifies:

- The frontend root route returns HTTP 200.
- `/api/health` responds with `{"status":"ok"}` via the proxy.

Run the smoke test after `docker compose up nginx certbot frontend backend` to confirm the routing before exposing the service publicly.
