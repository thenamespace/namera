# syntax=docker/dockerfile:1.7
# Build from the repository root: docker build -f apps/admin-portal/Dockerfile .

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV TURBO_TELEMETRY_DISABLED="1"
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate

FROM base AS pruner
WORKDIR /app
RUN npm install --global turbo@2.10.8
COPY . .
RUN turbo prune @namera-ai/admin-portal --docker

FROM base AS builder
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts
COPY --from=pruner /app/out/full/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline --ignore-scripts
ARG DOTENV=""
RUN printf '%s\n' "${DOTENV:-VITE_API_URL=https://api.namera.ai}" > apps/admin-portal/.env.production

RUN pnpm --filter @namera-ai/admin-portal build
RUN node apps/admin-portal/tooling/nginx-headers.mjs

FROM nginxinc/nginx-unprivileged:stable-alpine AS runner
COPY apps/admin-portal/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/admin-portal/dist/ /usr/share/nginx/html/
COPY --from=builder /app/apps/admin-portal/nginx-headers.conf /etc/nginx/namera-headers.conf
EXPOSE 8080
