# Compose Services

## EmulatorJS

The `emulatorjs` service now builds from source instead of pulling the LinuxServer image. The Dockerfile at `infrastructure/emulator/Dockerfile` clones [`EmulatorJS/EmulatorJS`](https://github.com/EmulatorJS/EmulatorJS), checks out the tag or commit referenced by `EMULATORJS_REF` (default `v4.2.3`), runs `pnpm install --frozen-lockfile=false && pnpm run build`, and copies the resulting `dist/` bundle into a minimal Caddy server image.

### Persistent data

- `emulatorjs_data` volume → `/srv/emulatorjs/dist/data` (used for ROM cache/config files that EmulatorJS writes at runtime).

### Rebuild instructions

1. Update `.env` (or export an environment variable) with the desired upstream tag/commit:
   ```bash
   export EMULATORJS_REF=v4.2.3   # use commits or release tags from EmulatorJS/EmulatorJS
   ```
2. Rebuild the container image:
   ```bash
   docker compose -f infrastructure/compose/docker-compose.yml build emulatorjs
   ```
3. Restart the service so the new build is served:
   ```bash
   docker compose -f infrastructure/compose/docker-compose.yml up -d emulatorjs
   ```

The Compose health check hits `http://localhost:${EMULATORJS_PORT:-8080}/healthz`, so when the container reports healthy the compiled `dist/` assets are available at `http://localhost:${EMULATORJS_PORT:-8080}/`.
