ARG NODE_VERSION=22.21.0
ARG PNPM_VERSION=10.23.0

FROM ubuntu:24.04
ARG NODE_VERSION
ARG PNPM_VERSION

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl xz-utils \
  && curl -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
  && mkdir -p /usr/local/lib/nodejs \
  && tar -xJf "node-v${NODE_VERSION}-linux-x64.tar.xz" -C /usr/local/lib/nodejs \
  && ln -s /usr/local/lib/nodejs/node-v${NODE_VERSION}-linux-x64 /usr/local/lib/nodejs/node \
  && ln -s /usr/local/lib/nodejs/node/bin/node /usr/local/bin/node \
  && ln -s /usr/local/lib/nodejs/node/bin/npm /usr/local/bin/npm \
  && ln -s /usr/local/lib/nodejs/node/bin/npx /usr/local/bin/npx \
  && ln -s /usr/local/lib/nodejs/node/bin/corepack /usr/local/bin/corepack \
  && corepack enable \
  && corepack prepare pnpm@${PNPM_VERSION} --activate \
  && rm -f "node-v${NODE_VERSION}-linux-x64.tar.xz" \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PNPM_HOME=/usr/local/share/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"

CMD ["sleep", "infinity"]
