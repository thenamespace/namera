# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV TURBO_TELEMETRY_DISABLED="1"

RUN corepack enable \
  && corepack prepare pnpm@11.18.0 --activate

FROM base AS pruner

WORKDIR /app

RUN npm install --global turbo@2.10.8

COPY . .

RUN turbo prune @namera-ai/server --docker

FROM base AS builder

WORKDIR /app

COPY --from=pruner /app/out/json/ .

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile --ignore-scripts

COPY --from=pruner /app/out/full/ .

# Refresh pnpm's workspace state after the source tree is restored. The store
# is already warm, so this keeps Docker's dependency layer cache effective.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile --offline --ignore-scripts

RUN pnpm exec turbo run build --filter=@namera-ai/server...

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm --ignore-scripts --filter @namera-ai/server --prod deploy --legacy /app/server

FROM node:24-bookworm-slim AS runner

ENV NODE_ENV="production"
ENV NODE_OPTIONS="--enable-source-maps"
ENV SERVER_HOST="0.0.0.0"
ENV SERVER_PORT="8080"

WORKDIR /app

COPY --from=builder --chown=node:node /app/server/ ./

USER node

EXPOSE 8080

CMD ["node", "dist/index.js"]
