# syntax=docker/dockerfile:1

FROM node:22-bookworm AS base
WORKDIR /app

FROM base AS deps
ENV NODE_ENV=development
COPY package.json ./package.json
COPY package-lock.json ./package-lock.json
RUN npm ci

FROM deps AS development
ENV NODE_ENV=development
RUN npm install --include=dev
COPY . ./
CMD ["npm", "run", "dev"]

FROM deps AS build
ENV NODE_ENV=production
COPY . ./
RUN npm run build

FROM base AS production
ENV NODE_ENV=production
COPY package.json ./package.json
COPY package-lock.json ./package-lock.json
RUN npm ci --omit=dev
COPY prisma ./prisma
COPY scripts/ensure-prisma-command-state.mjs ./scripts/ensure-prisma-command-state.mjs
COPY scripts/run-platform-seed-if-available.mjs ./scripts/run-platform-seed-if-available.mjs
ARG PRISMA_GENERATE_DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/treazrisland"
RUN DATABASE_URL="$PRISMA_GENERATE_DATABASE_URL" npm run prisma:generate
COPY --from=build /app/dist ./dist
ENV PORT=3001
EXPOSE 3001
CMD ["node", "dist/index.js"]
