FROM node:22.11-bullseye

WORKDIR /app

ENV PNPM_HOME=/usr/local/share/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"

RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

CMD ["sleep", "infinity"]
