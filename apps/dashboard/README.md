# @namera-ai/dashboard

Namera's browser dashboard. It uses Vite, React, TanStack Router, Tailwind CSS,
and the shared `@namera-ai/ui` component package.

Dashboard-local imports use the `@/` alias for `src/` and omit file extensions.
Workspace package imports continue to use their package names.

## Structure

- `src/routes/` — file-based TanStack Router routes.
- `src/routes/**/-components/` — UI used by one route or route group. Keep a
  single-file component directly in this directory. Give it a folder with an
  `index.tsx` entry only after it is split across multiple files.
- `src/components/` — components shared by unrelated routes. Do not move route-only
  components here.
- `src/atoms/` — typed API query and mutation atoms, invalidation keys, and loader prefetching.
- `src/hooks/` — React Atom adapters and domain hooks.
- `src/env.ts` — required browser environment decoded synchronously with Effect Config.
- `src/router.tsx` — router construction.
- `src/router-context.ts` — services shared by route loaders and the rendered application.
- `src/routeTree.gen.ts` — generated route tree; do not edit manually.
- `src/styles.css` — application stylesheet entry importing Namera UI styles.
- `vite.config.ts` — Vite, Router, React, Tailwind, and devtools plugins.

## Authentication routes

- `/auth` contains the magic-link request UI.
- `/auth/verify` contains the browser-session confirmation UI.

The routes are currently presentation-only. API behavior is added through atoms
and hooks after the interaction design is settled.

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
- Keep route files small: declare the TanStack route and render a component from
  the nearest `-components/` directory. Do not create one-file component folders.
- Use Motion for restrained state transitions and microinteractions. Respect
  reduced-motion preferences and do not animate UIKit components internally.
- Use `usehooks-ts` for established reusable browser behaviors such as
  debouncing, media queries, and stepped state. Keep one-off local state local.
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
