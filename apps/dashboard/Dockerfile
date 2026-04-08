# ---------- base ----------
FROM oven/bun:1-slim AS base
WORKDIR /app

# ---------- prepare workspace ----------
FROM base AS prepare
RUN bun add -g turbo

COPY . .
RUN turbo prune --scope=@namera-ai/dashboard --docker

# ---------- dependencies ----------
FROM base AS deps
WORKDIR /app

COPY --from=prepare /app/out/json/ .
RUN bun install --production --frozen-lockfile --ignore-scripts
COPY --from=prepare /app/out/full/ .

# ---------- runtime ----------
FROM nginx:alpine

COPY --from=deps /app/apps/dashboard/dist /usr/share/nginx/html
COPY --from=deps /app/apps/dashboard/nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]