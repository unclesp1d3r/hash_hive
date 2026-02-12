FROM oven/bun:1-alpine AS base
WORKDIR /app

# ─── Install dependencies ────────────────────────────────────────────
FROM base AS deps
COPY package.json bun.lock ./
COPY packages/backend/package.json packages/backend/
COPY packages/shared/package.json packages/shared/
COPY packages/openapi/package.json packages/openapi/
RUN bun install --frozen-lockfile --production

# ─── Build shared package ────────────────────────────────────────────
FROM base AS build
COPY package.json bun.lock tsconfig.base.json ./
COPY packages/backend/package.json packages/backend/
COPY packages/shared/package.json packages/shared/
COPY packages/openapi/package.json packages/openapi/
RUN bun install --frozen-lockfile

COPY packages/shared/ packages/shared/
RUN cd packages/shared && bun run build

COPY packages/backend/ packages/backend/
RUN cd packages/backend && bun build src/index.ts --outdir dist --target bun

# ─── Production image ────────────────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production

COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/packages/backend/node_modules packages/backend/node_modules
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/shared/package.json packages/shared/
COPY --from=build /app/packages/backend/dist packages/backend/dist
COPY --from=build /app/packages/backend/package.json packages/backend/

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["bun", "packages/backend/dist/index.js"]
