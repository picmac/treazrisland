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
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
ENV PORT=3001
EXPOSE 3001
CMD ["node", "dist/index.js"]
