# @namera-ai/dashboard

Namera's browser dashboard. It uses Vite, React, TanStack Router, Tailwind CSS,
and the shared `@namera-ai/ui` component package.

Dashboard-local imports use the `@/` alias for `src/` and omit file extensions.
Workspace package imports continue to use their package names.

## Structure

- `src/routes/` — file-based TanStack Router routes.
- `src/atoms/` — typed API query and mutation atoms, invalidation keys, and loader prefetching.
- `src/hooks/` — React Atom adapters and domain hooks.
- `src/env.ts` — required browser environment decoded synchronously with Effect Config.
- `src/router.tsx` — router construction.
- `src/router-context.ts` — services shared by route loaders and the rendered application.
- `src/routeTree.gen.ts` — generated route tree; do not edit manually.
- `src/styles.css` — application stylesheet entry importing Namera UI styles.
- `vite.config.ts` — Vite, Router, React, Tailwind, and devtools plugins.

## Authentication routes

- `/` redirects to `/dashboard`.
- `/_authenticated` is the pathless protected layout. Its loader prefetches the
  current user with the router's shared Effect atom registry and redirects
  unauthenticated requests to `/auth`.
- `/auth` requests a single-use magic link.
- `/auth/verify` validates the link parameters, asks for browser-session
  consent, verifies the token, and follows the server-provided return path.
- `/dashboard` renders inside the protected layout and reads the prefetched
  actor without a duplicate request.

## UI conventions

Use components, hooks, icons, utilities, and styles through `@namera-ai/ui`.
Examples in the [Namespace UIKit documentation](https://namespace-uikit.vercel.app/llms.txt)
that import `@thenamespace/uikit` map directly to `@namera-ai/ui` in this app.

- Prefer UIKit components for controls, forms, feedback, surfaces, and
  typography. Use semantic HTML for document structure and TanStack Router for
  navigation boundaries.
- Use semantic UIKit color tokens such as `background`, `surface`, `muted`,
  `separator`, `accent`, and status colors. Do not hardcode palette colors.
- Preserve React Aria labels, descriptions, validation, focus states, and
  keyboard behavior. Async form feedback must be announced with `role="alert"`
  or an appropriate live region.
- Keep route loaders and rendered queries on the same router-owned atom
  registry so prefetched values are reused.

## Environment

| Variable       | Description             |
| -------------- | ----------------------- |
| `VITE_API_URL` | Namera API base origin. |

## Commands

```sh
pnpm --filter @namera-ai/dashboard dev
pnpm --filter @namera-ai/dashboard generate-routes
pnpm --filter @namera-ai/dashboard typecheck
pnpm --filter @namera-ai/dashboard build
```
