# @namera-ai/dashboard

Browser application for managing Namera accounts, session keys, identities,
workspace access, and billing. Built with Vite, React, TanStack Router, Effect
Atom, and the shared UI package.

## Development

Copy [.env.example](.env.example) to `.env` in this directory and run the API
alongside the dashboard. From the repository root:

```sh
pnpm --filter @namera-ai/dashboard dev
```

Development uses port 3000. `VITE_API_URL` selects the backend and is embedded
in the build. `VITE_TELEMETRY_SERVICE_VERSION` labels browser telemetry.
Browser configuration must not contain secrets.

## Code ownership

| Directory        | Responsibility                                      |
| ---------------- | --------------------------------------------------- |
| `src/routes`     | Route declarations, loaders, adjacent route-only UI |
| `src/atoms`      | Typed HTTP state, cache keys, prefetching           |
| `src/hooks`      | React adapters and domain workflows                 |
| `src/components` | Cross-route UI, transaction review, policy editors  |
| `src/lib`        | Focused browser/domain utilities                    |
| `tooling`        | Document metadata and security headers              |

Use `@/` for dashboard imports. Share cross-app presentation through
`@namera-ai/ui`; keep authority and request orchestration here. Do not edit
the generated route tree manually.

Protected loaders and hooks share one atom registry. Server permissions remain
authoritative. Forms use React Hook Form and Effect Schema; mutation feedback
uses the shared error registry. See [dashboard architecture](../../architecture/interfaces/dashboard.md)
for cache isolation, approvals, autosave, and browser boundaries.

## Verification

```sh
pnpm --filter @namera-ai/dashboard test
pnpm --filter @namera-ai/dashboard typecheck
pnpm --filter @namera-ai/dashboard typecheck:test
pnpm --filter @namera-ai/dashboard lint
pnpm --filter @namera-ai/dashboard build
```

Real-browser tests use Chromium for transaction review, autosave lifecycle, and
shared controls. Install the matching browser once, then run the separate lane:

```sh
pnpm --filter @namera-ai/dashboard exec playwright install chromium
pnpm --filter @namera-ai/dashboard test:browser
```

The browser lane loads the application theme but no local environment files.
Tests reject unexpected HTTP requests and use controlled session/clipboard
boundaries. Node tests remain in `tests/unit` and `tests/integration`; browser
tests live in `tests/browser`. Neither lane submits real transactions.

## Deployment

```sh
docker build -f apps/dashboard/Dockerfile -t namera-dashboard .
docker run --rm -p 3000:8080 namera-dashboard
```

Build from the repository root. The image serves static assets through nginx
with SPA fallback and generated security headers. Configure the API's matching
dashboard origin, cookies, and WebAuthn relying party. Rebuild when changing
public environment values. See [delivery](../../architecture/runtime/delivery.md).
