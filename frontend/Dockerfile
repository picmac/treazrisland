# syntax=docker/dockerfile:1

FROM node:24-bullseye AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS development
ENV NODE_ENV=development
RUN npm install --include=dev
COPY . .
CMD ["npm", "run", "dev"]

FROM deps AS build
ENV NODE_ENV=production
COPY . .
RUN npm run build

FROM base AS production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm install --no-save typescript@5.9.3
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/security-headers.ts ./security-headers.ts
COPY --from=build /app/security-headers.ts ./security-headers.ts
ENV PORT=3000
EXPOSE 3000
CMD ["npm", "run", "start"]
