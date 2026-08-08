# @namera-ai/server

The Node.js composition root for the Namera API. It owns the HTTP runtime,
transport middleware, API handler implementations, authorization, and assembly
of live infrastructure and application layers.

No API handlers are implemented yet. The current scaffold starts an Effect HTTP
server and exposes the `@namera-ai/api` contract through Scalar at `/reference`.

## Structure

- `src/config.ts` — server host, port, and browser origin configuration.
- `src/routes/` — HTTP handler layers and the Scalar API reference route.
- `src/middlewares/` — transport middleware such as CORS and future authorization.
- `src/layers/` — runtime and dependency composition.
- `src/index.ts` — Node process entry point.

Future route files implement groups from `@namera-ai/api` and call services from
`@namera-ai/application`. Business workflows do not belong in this app.

## Environment

All values have local development defaults.

| Variable             | Default                 | Purpose                         |
| -------------------- | ----------------------- | ------------------------------- |
| `SERVER_HOST`        | `0.0.0.0`               | HTTP listen host.               |
| `SERVER_PORT`        | `8080`                  | HTTP listen port.               |
| `SERVER_CORS_ORIGIN` | `http://localhost:3000` | Allowed credentialed UI origin. |

Only one exact CORS origin is allowed because credentialed requests must not use
a wildcard origin.

## Commands

```sh
pnpm --filter @namera-ai/server dev
pnpm --filter @namera-ai/server build
pnpm --filter @namera-ai/server start
```
