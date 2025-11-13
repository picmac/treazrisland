FROM node:20.14-bullseye

WORKDIR /app

ENV PNPM_HOME=/usr/local/share/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"

RUN corepack enable && corepack prepare pnpm@9.5.0 --activate

CMD ["sleep", "infinity"]
