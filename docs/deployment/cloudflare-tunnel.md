# Cloudflare Tunnel Setup

This guide explains how to expose local TREAZRISLAND services through a Cloudflare Tunnel. It assumes you already have a Cloudflare account and a zone that you control.

## 1. Generate a tunnel token

1. Install the [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) CLI locally or open the Cloudflare dashboard.
2. In **Zero Trust → Networks → Tunnels**, create a new tunnel and choose the **"Use tunnel token"** option.
3. Copy the generated token value. Store it as `CLOUDFLARE_TUNNEL_TOKEN` in your `.env` file or export it in the shell before starting the tunnel.
4. (Optional) Download the tunnel credentials JSON if you plan to run a named tunnel outside of the token flow. Place it in `infra/cloudflared/` and uncomment the `tunnel` and `credentials-file` entries in `infra/cloudflared/config.yml`.

## 2. Configure DNS

For each public hostname you want to expose, create a CNAME record in Cloudflare DNS pointing to the tunnel endpoint that was generated. The value follows the pattern `<tunnel-uuid>.cfargotunnel.com`.

Example records:

| Hostname | Type | Value |
|----------|------|-------|
| `frontend.treazrisland.dev` | CNAME | `<tunnel-uuid>.cfargotunnel.com` |
| `api.treazrisland.dev` | CNAME | `<tunnel-uuid>.cfargotunnel.com` |

Proxy status should remain **Proxied** so that traffic traverses the Cloudflare network.

## 3. Verify ingress rules

The repository provides `infra/cloudflared/config.yml` with sample ingress mappings:

- `frontend.treazrisland.dev` → `http://frontend:3000`
- `api.treazrisland.dev` → `http://backend:3001`
- Catch-all rule returning HTTP 404

Update the hostnames if your domain differs. Additional services can be appended by adding new `ingress` entries.

### TLS-aware environment variables

Even though `cloudflared` connects to the local services over HTTP, visitors reach the tunnel using HTTPS. Update the shared
`.env` file accordingly before exposing the stack:

- Ensure `TREAZ_TLS_MODE=https` (or leave `auto` with `TREAZ_RUNTIME_ENV=production`) so the frontend emits HSTS/`upgrade-insecure-requests` headers.
- Replace `NEXT_PUBLIC_API_BASE_URL` and `CORS_ALLOWED_ORIGINS` with the public `https://` hostnames served by your tunnel.
- If MinIO or another object store is reachable over HTTPS, point `STORAGE_ENDPOINT` at that URL (otherwise leave the local HTTP
  endpoint for development).

## 4. Start the tunnel in development

1. Ensure Docker is running and that the local `frontend` and `backend` services are healthy (`docker compose up frontend backend`).
2. Populate `CLOUDFLARE_TUNNEL_TOKEN` in `.env` (or export it in your shell).
3. Run `scripts/start-cloudflared.sh`. The script sources `.env`/`.env.local` automatically and invokes `docker compose --profile cloudflared up cloudflared`.
4. When the container reports `Connection established`, the public hostnames should proxy to your local services.

Stop the tunnel with `Ctrl+C` or `docker compose --profile cloudflared down`.

## 5. Optional protections

- **Cloudflare Access**: Require SSO before reaching the tunnel by attaching Access policies to the hostnames you created. Protecting both the frontend and backend paths prevents unauthorised gameplay during demos.
- **Web Application Firewall (WAF)**: Enable relevant managed rulesets for the zone to filter malicious traffic. Add custom rules for rate limiting or country restrictions if you expect targeted testing.
- **Zero Trust policies**: Use device posture checks (e.g., CrowdStrike, disk encryption) to restrict who can reach staging tunnels.

## 6. Troubleshooting tips

- Use `docker compose logs -f cloudflared` to inspect connection attempts or TLS negotiation issues.
- Ensure the Docker network includes the `frontend` and `backend` containers; the tunnel resolves them by service name.
- For WebSocket-heavy features, confirm the Cloudflare zone has WebSocket support enabled (it is on by default for proxied records).
- For large ROM uploads, increase the client upload limit in Cloudflare (Enterprise) or route uploads through signed URLs to MinIO.

With the tunnel running, teammates and stakeholders can explore TREAZRISLAND without deploying the stack to a public cloud environment.
