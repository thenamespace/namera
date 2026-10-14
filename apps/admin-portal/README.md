# @namera-ai/admin-portal

Private operator SPA for platform membership, beta admission, feedback, catalog,
and contract interfaces. Built with Vite, React, TanStack Router, Effect Atom,
and `@namera-ai/ui`.

All data goes through the server's `/internal` API. A verified user session and
active platform membership are required; workspace membership is not admin access.

## Development

Copy [.env.example](.env.example) to `.env`, start the API, and run:

```sh
pnpm --filter @namera-ai/admin-portal dev
```

The portal uses port 3003. Set `VITE_API_URL` to the API origin and the server's
`ADMIN_CORS_ORIGIN` to the exact portal origin.
`VITE_TELEMETRY_SERVICE_VERSION` optionally labels browser telemetry.
Provider credentials and database connections belong on the server.

## Structure

- `src/routes`: sign-in, protected pages, and invitation acceptance.
- `src/atoms` and `src/hooks`: HTTP state, cache keys, and mutation invalidation.
- `src/components`: portal layout and permission-aware presentation.
- `src/lib`: access feedback and invitation handling.
- `tooling`: document security and metadata.

Loaders check permissions before fetching protected data. Controls use effective
permissions, with server checks on every request. See
[portal architecture](../../architecture/interfaces/admin-portal.md) and
[platform administration](../../architecture/identity-access/administration.md).

## Checks and deployment

```sh
pnpm --filter @namera-ai/admin-portal test
pnpm --filter @namera-ai/admin-portal typecheck
pnpm --filter @namera-ai/admin-portal lint
pnpm --filter @namera-ai/admin-portal build
```

The Dockerfile serves static assets through nginx. API origin changes require a
rebuild. Deploy with a compatible HTTPS cookie policy and exact CORS origin.
