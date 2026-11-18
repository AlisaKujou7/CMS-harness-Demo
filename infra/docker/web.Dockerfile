# syntax=docker/dockerfile:1.7
# Built from the repository root. nginx serves the SPA itself, option B in 07-OPS-ARCH 4.1, so the
# assets are versioned with the image.
FROM node:26.13.0-bookworm-slim AS builder
WORKDIR /repo
RUN npm install --global pnpm@12.16.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY cms-api/package.json cms-api/
COPY cms-web/package.json cms-web/
COPY infra/migrate/package.json infra/migrate/
RUN pnpm install --frozen-lockfile --ignore-scripts --filter cms-web
COPY cms-web cms-web
RUN pnpm --filter cms-web build && find cms-web/dist -name '*.map' -delete

FROM nginxinc/nginx-unprivileged:1.31.7-alpine AS runtime
# The base image lags Alpine's security fixes (M-INF-01).
USER root
RUN apk upgrade --no-cache
USER 101
COPY --from=builder /repo/cms-web/dist /usr/share/nginx/html
