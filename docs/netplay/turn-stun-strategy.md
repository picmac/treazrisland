# TURN/STUN Strategy for TREAZRISLAND Netplay

## Context
TREAZRISLAND's netplay feature relies on WebRTC sessions between self-hosted peers. Reliable NAT traversal is required while preserving the project's privacy-first posture. This document evaluates the trade-offs between running a self-hosted [coturn](https://github.com/coturn/coturn) deployment and consuming a managed TURN/STUN provider, then records the chosen direction, provisioning workflow, and compliance implications.

## Option Evaluation
### Self-hosted coturn
- **Privacy** – Credentials, relay traffic, and usage metadata remain within TREAZRISLAND's infrastructure boundary. No third party observes player IP addresses, session timings, or TURN credentials.
- **Availability** – We control maintenance windows, scaling, and monitoring. coturn is lightweight (single binary) and well-suited to container orchestration. High availability requires running multiple replicas behind anycast or DNS round-robin, but even a single instance provides deterministic behaviour for the home deployment target.
- **Operational overhead** – Requires managing TLS certificates (if exposing TLS transports), firewall rules, and periodic security updates. However, the existing Docker-based toolchain and monitoring stack minimise incremental toil.

### Managed TURN/STUN service
- **Privacy** – Requires sharing subscriber information and live relay traffic with a third party. Typical terms-of-service allow providers to store logs for abuse and billing, creating an additional data controller that conflicts with the privacy-first mandate.
- **Availability** – Enterprise providers offer global POPs and built-in failover. Availability SLAs can be attractive, but outages are outside TREAZRISLAND's control and vendor lock-in complicates future migrations.
- **Operational overhead** – Simplifies upkeep (no patching), yet introduces vendor management, billing, and compliance assessments. Integrating with vendor APIs would require mapping their credentials and health endpoints into our observability stack.

## Decision
Choose **self-hosted coturn** for all production and staging environments. This satisfies the privacy constraint by ensuring player metadata never leaves TREAZRISLAND-operated systems, keeps credentials within existing secret-management processes, and aligns with the project's self-hosted ethos. Availability requirements are met through containerised deployment with health checks and optional horizontal scaling if netplay load increases.

Managed TURN/STUN offerings remain a contingency option if future load exceeds home-lab capabilities; any evaluation must include a DPA review and a technical plan for end-to-end encryption of TURN credentials at rest.

## Provisioning Steps
1. **Secrets & configuration**
   - Generate a strong static credential for long-term authentication (e.g., `NETPLAY_TURN_PASSWORD`) or configure a shared secret for REST API key generation if the backend adopts REST-based credentials later.
   - Set `TURN_REALM` to the primary FQDN served to peers (e.g., `treazrisland.localhost` for LAN or `turn.treazrisland.example.com` for production).
   - Define TURN listening ports and relay ranges (`TURN_LISTEN_PORT`, `TURN_TLS_PORT`, `TURN_MIN_PORT`, `TURN_MAX_PORT`). Ensure firewall openings for both TCP and UDP ranges.
   - Publish TURN/STUN URIs to clients via backend configuration (`NETPLAY_TURN_URIS`, `NETPLAY_STUN_URIS`) alongside the shared username/password.
2. **Container deployment**
   - Use the `coturn` service defined in `infra/docker-compose.yml` (and variants) or integrate the same configuration into other orchestrators.
   - Mount TLS key/cert material if TLS transports are required; by default the compose profile runs in UDP mode without TLS for local development.
   - Enable health monitoring through Prometheus by scraping the TURN process (optional) or by adding synthetic netplay probes that validate relay round-trips.
3. **Networking**
   - When deploying behind NAT, set `TURN_EXTERNAL_IP` to the routable public IP so relay candidates are correct.
   - For IPv6 support, extend the compose command with `--listening-ip=::` and adjust firewall policies accordingly.
4. **Testing**
   - Validate STUN-only connections for low-latency peers, then confirm TURN relays succeed by forcing relay usage (disable direct ICE candidates during QA or use browsers' `forceRelay` debugging tools).
   - Document QA procedures in `docs/testing/e2e.md` when end-to-end netplay flows are implemented.

## Compliance Notes
- **Data minimisation** – Configure coturn logging to redact credentials and rotate logs following TREAZRISLAND's retention policy. Avoid enabling verbose traffic dumps in production.
- **Access control** – Store TURN credentials in the same secret store as backend JWT/MFA secrets. Rotate at least quarterly or when staff changes occur.
- **Incident response** – Add TURN availability metrics and alerts so outages surface in the monitoring stack. Include the TURN host in existing vulnerability management routines (patch cadence aligned with other infrastructure containers).
- **Documentation** – Keep this document and `docs/security/hardening-checklist.md` in sync when policies change. Record any deviations (e.g., temporary managed TURN usage) in the change-management log.
