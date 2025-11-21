# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:22.21-bookworm-slim
FROM ${NODE_IMAGE} AS build

RUN apt-get update \
  && apt-get install -y git p7zip-full \
  && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/usr/local/share/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"

RUN corepack enable && corepack prepare pnpm@10.23.0 --activate

WORKDIR /src

ARG EMULATORJS_REF=v4.2.3
ARG EMULATORJS_REPOSITORY=https://github.com/EmulatorJS/EmulatorJS.git

RUN git clone --filter=blob:none "$EMULATORJS_REPOSITORY" . \
  && git checkout "$EMULATORJS_REF"

# EmulatorJS's build script tries to use `process.stdout.clearLine()` and
# `process.stdout.cursorTo()` for progress updates. Those helpers are not
# available when stdout is not a TTY (like during Docker builds), so we inject
# harmless fallbacks before running the build. This mirrors what Node would do
# when a TTY is present and keeps the upstream sources untouched.
RUN node - <<'NODE'
const fs = require('fs');
const path = require('path');
const filePath = path.resolve('build.js');
const sentinel = '// TreazrIsland patch: guard stdout helpers';
let contents = fs.readFileSync(filePath, 'utf8');
if (!contents.includes(sentinel)) {
  const injection = `\n${sentinel}\nconst stdout = process.stdout;\nif (typeof stdout.clearLine !== 'function') {\n  stdout.clearLine = () => {};\n}\nif (typeof stdout.cursorTo !== 'function') {\n  stdout.cursorTo = () => {};\n}\n`;
  const needle = '\nlet version;';
  if (!contents.includes(needle)) {
    throw new Error('Unable to find insertion point for stdout guards');
  }
  contents = contents.replace(needle, `${needle}${injection}`);
  fs.writeFileSync(filePath, contents);
}
NODE

# EmulatorJS does not provide a package-lock.json, so rely on pnpm's
# workspace install while allowing lockfile generation during the build.
RUN pnpm install --frozen-lockfile=false
RUN pnpm run build

FROM caddy:2.9.1-alpine AS runtime

WORKDIR /srv/emulatorjs

COPY --from=build /src/dist ./dist
# Copy the local Caddyfile so we can proxy the compiled EmulatorJS assets.
COPY Caddyfile /etc/caddy/Caddyfile

RUN mkdir -p /srv/emulatorjs/dist/data

EXPOSE 80
VOLUME ["/srv/emulatorjs/dist/data"]

HEALTHCHECK --interval=30s --timeout=5s --retries=5 --start-period=10s \
  CMD wget -q -O - http://localhost/healthz || exit 1

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]
