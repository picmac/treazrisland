# Security Documentation

This folder will contain the TREAZRISLAND threat model, hardening checklist, and security operations workflows. Reference the Coding Agents Playbook and docs/TREAZRISLAND_PRD.md for baseline requirements until the dedicated documents are authored.

### Netplay considerations

- Treat the signaling layer as an external dependency with its own trust boundary. All traffic must be authenticated via `NETPLAY_SERVICE_API_KEY` and encrypted in production.
- Enforce strict TTL bounds (`NETPLAY_SESSION_MIN_TTL_MINUTES`–`NETPLAY_SESSION_MAX_TTL_MINUTES`) to limit the usefulness of stolen join codes.
- Apply rate limiting on session creation and join operations to mitigate brute-force attacks. Correlate repeated failures in telemetry to trigger abuse response.
- Hash join codes (`sha256(joinCode)`) before storing or logging them and avoid exposing peer connection details to unauthenticated users.
