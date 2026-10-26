# ---------- build ----------
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# prisma.config.ts exige DIRECT_URL, mas `generate` não conecta no banco.
RUN DIRECT_URL="postgresql://build:build@localhost:5432/build" npx prisma generate \
  && npm run build \
  && npm prune --omit=dev

# ---------- runtime ----------
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
# Necessários para `prisma migrate deploy` dentro do container
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./

USER node
EXPOSE 3000
CMD ["node", "dist/main"]
