# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:20-alpine
FROM ${NODE_IMAGE} AS build

RUN apk add --no-cache git

WORKDIR /src

ARG EMULATORJS_REF=v4.2.3
ARG EMULATORJS_REPOSITORY=https://github.com/EmulatorJS/EmulatorJS.git

RUN git clone --filter=blob:none "$EMULATORJS_REPOSITORY" . \
  && git checkout "$EMULATORJS_REF"

RUN npm ci
RUN npm run build

FROM caddy:2.9.1-alpine AS runtime

WORKDIR /srv/emulatorjs

COPY --from=build /src/dist ./dist
# The Docker build context for this image is the repository root, so the
# Caddyfile must be referenced relative to that root.
COPY infrastructure/emulator/Caddyfile /etc/caddy/Caddyfile

RUN mkdir -p /srv/emulatorjs/dist/data

EXPOSE 80
VOLUME ["/srv/emulatorjs/dist/data"]

HEALTHCHECK --interval=30s --timeout=5s --retries=5 --start-period=10s \
  CMD wget -q -O - http://localhost/healthz || exit 1

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]
