# syntax=docker/dockerfile:1.7
# Build from the repository root: docker build -f apps/web/Dockerfile .

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV TURBO_TELEMETRY_DISABLED="1"
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate

FROM base AS pruner
WORKDIR /app
RUN npm install --global turbo@2.10.8
COPY . .
RUN turbo prune @namera-ai/web --docker

FROM base AS builder
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts
COPY --from=pruner /app/out/full/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline --ignore-scripts
ARG DOTENV=""
RUN printf '%s\n' "${DOTENV:-VITE_API_URL=https://api.namera.ai}" > apps/web/.env.production

RUN NITRO_PRESET=node-server pnpm --filter @namera-ai/web build

FROM node:24-bookworm-slim AS runner
ENV NODE_ENV="production"
ENV NITRO_HOST="0.0.0.0"
ENV NITRO_PORT="8080"
WORKDIR /app
COPY --from=builder --chown=node:node /app/apps/web/.output/ ./
USER node
EXPOSE 8080
CMD ["node", "server/index.mjs"]
