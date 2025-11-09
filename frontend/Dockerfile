# syntax=docker/dockerfile:1

FROM node:24-bookworm AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS deps
COPY frontend/package.json ./package.json
COPY frontend/package-lock.json ./package-lock.json
RUN npm ci

FROM deps AS development
ENV NODE_ENV=development
RUN npm install --include=dev
COPY frontend/. ./
CMD ["npm", "run", "dev"]

FROM deps AS build
ENV NODE_ENV=production
ENV TREAZ_TLS_MODE=http
COPY frontend/. ./
RUN npm run build

FROM base AS production
COPY frontend/package.json ./package.json
COPY frontend/package-lock.json ./package-lock.json
RUN npm ci --omit=dev && npm install --no-save typescript@5.9.3
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/security-headers.ts ./security-headers.ts
COPY --from=build /app/scripts ./scripts
ENV PORT=3000
ENV TREAZ_TLS_MODE=http
EXPOSE 3000
CMD ["node", "./scripts/start-http.mjs"]
