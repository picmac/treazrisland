FROM node:22.21-bullseye

WORKDIR /app

ENV PNPM_HOME=/usr/local/share/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"

RUN corepack enable && corepack prepare pnpm@10.23.0 --activate

CMD ["sleep", "infinity"]
