# ---------- base ----------
FROM node:24-alpine AS base
RUN apk add --no-cache openssl ca-certificates
WORKDIR /app

# ---------- build ----------
FROM base AS build

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# prisma.config.ts exige DIRECT_URL, mas `generate` não conecta no banco.
RUN DIRECT_URL="postgresql://build:build@localhost:5432/build" ./node_modules/.bin/prisma generate \
  && npm run build \
  && npm prune --omit=dev \
  && test -x node_modules/.bin/prisma \
  && test -f dist/main.js

# ---------- runtime ----------
FROM base AS runtime
ENV NODE_ENV=production \
    HOME=/home/node

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts ./
COPY --chown=node:node --chmod=755 docker-entrypoint.sh ./

USER node
EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
