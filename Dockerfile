FROM node:22-bookworm-slim AS client-build
WORKDIR /app
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client ./
RUN npm run build

FROM node:22-bookworm-slim AS server-build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/prisma ./prisma
COPY server/tsconfig.json server/tsconfig.build.json ./
COPY server/src ./src
RUN npx prisma generate && npx tsc -p tsconfig.build.json
RUN cp -r src/db/seedContent/cpp dist/db/seedContent/cpp

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
ENV UPLOAD_DIR=/data/uploads
ENV STATIC_DIR=/app/public
RUN mkdir -p /data/uploads && chown node:node /data/uploads
COPY --from=server-build /app/node_modules ./node_modules
COPY --from=server-build /app/dist ./dist
COPY --from=server-build /app/prisma ./prisma
COPY --from=client-build /app/dist ./public
COPY server/package.json ./
USER node
EXPOSE 10000
CMD ["sh", "-c", "npx prisma migrate deploy && API_PORT=${PORT:-10000} node dist/server.js"]
