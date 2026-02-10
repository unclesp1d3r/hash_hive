FROM oven/bun:1-alpine AS build
WORKDIR /app

COPY package.json bun.lock tsconfig.base.json ./
COPY packages/frontend/package.json packages/frontend/
COPY packages/shared/package.json packages/shared/
COPY packages/openapi/package.json packages/openapi/
RUN bun install --frozen-lockfile

COPY packages/shared/ packages/shared/
RUN cd packages/shared && bun run build

COPY packages/frontend/ packages/frontend/
RUN cd packages/frontend && bun run build

# ─── Production image with nginx ─────────────────────────────────────
FROM nginx:alpine AS production

COPY --from=build /app/packages/frontend/dist /usr/share/nginx/html
COPY packages/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1
