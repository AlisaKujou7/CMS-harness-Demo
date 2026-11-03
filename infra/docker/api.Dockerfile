# syntax=docker/dockerfile:1.7
# Built from the repository root. One image runs the API and the worker (07-OPS-ARCH 4.1), and the
# `migrate` target is a separate image, because the Prisma CLI is build tooling (07-OPS-ARCH 10.2).
FROM node:26.13.0-bookworm-slim AS builder
WORKDIR /repo
RUN npm install --global pnpm@12.16.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY cms-api/package.json cms-api/
COPY cms-web/package.json cms-web/
COPY infra/migrate/package.json infra/migrate/
RUN pnpm install --frozen-lockfile --ignore-scripts --filter cms-api
COPY cms-api cms-api
RUN pnpm --filter cms-api exec prisma generate \
  && pnpm --filter cms-api build \
  && pnpm --filter cms-api deploy --prod --legacy --ignore-scripts /out
# M-INF-03 allows 300 MB and Node alone is 150. Nothing at runtime reads types or source maps, and
# Prisma ships a query compiler for each database, where this one only ever uses Postgres's.
RUN find /out/node_modules -type f \
    \( -name '*.map' -o -name '*.d.ts' -o -name '*.d.mts' -o -name '*.d.cts' -o -name '*.md' \) -delete \
  && find /out/node_modules/.pnpm/@prisma+client*/node_modules/@prisma/client/runtime -type f \
    \( -name '*cockroachdb*' -o -name '*mysql*' -o -name '*sqlite*' -o -name '*sqlserver*' \) -delete \
  && rm -rf /out/node_modules/.pnpm/@types+* /out/node_modules/.pnpm/typescript@*

# Distroless has no shell or package manager. Node only needs libatomic beyond what it provides.
FROM gcr.io/distroless/cc-debian13:nonroot AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /usr/local/bin/node /usr/local/bin/node
COPY --from=builder /lib/x86_64-linux-gnu/libatomic.so.1 /lib/x86_64-linux-gnu/libatomic.so.1
COPY --from=builder /out/node_modules ./node_modules
COPY --from=builder /out/package.json ./package.json
COPY --from=builder /repo/cms-api/dist ./dist
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=4 \
  CMD ["node", "-e", "fetch('http://localhost:3000/healthz').then((r)=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "dist/main.js"]

# The schema engine needs OpenSSL, and this image only exists for the moment a migration runs.
FROM node:26.13.0-bookworm-slim AS migrate-builder
WORKDIR /repo
RUN npm install --global pnpm@12.16.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY cms-api/package.json cms-api/
COPY cms-web/package.json cms-web/
COPY infra/migrate/package.json infra/migrate/
RUN pnpm install --frozen-lockfile --filter cms-migrate --ignore-scripts \
  && pnpm --filter cms-migrate deploy --legacy --ignore-scripts /out

FROM node:26.13.0-bookworm-slim AS migrate
RUN apt-get update \
  && apt-get install --yes --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /opt/yarn* \
  && groupadd --gid 1001 migrate \
  && useradd --uid 1001 --gid migrate --create-home migrate
WORKDIR /app
COPY --from=migrate-builder /out/node_modules ./node_modules
COPY --from=migrate-builder /out/package.json ./package.json
COPY infra/migrate/prisma.config.ts ./prisma.config.ts
COPY cms-api/prisma ./prisma
RUN chown -R migrate:migrate /app/node_modules/.pnpm/@prisma+engines*
USER migrate
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]
