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
- `src/components/display/` — reusable compact value renderers for metadata,
  email addresses, dates, roles, and future table cells.
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

Notification inbox and preference atoms/hooks are available under
`src/atoms/notification` and `src/hooks/notification`. The settings page renders
the supported email preference topics; inbox UI is not implemented yet.

## Settings routes

- `/settings/profile` contains the React Hook Form profile presentation. Data
  loading and update behavior are intentionally not connected yet.
- `/settings/notifications` contains grouped product, account, and organization
  email preference forms backed by the notification preference DTO.
- `/settings/security` presents active sessions using the session response
  contract. It currently uses demo data and has no revocation behavior.
- `/settings/workspace` contains the organization logo and name form backed by
  the organization update DTO.
- `/settings/workspace/members` presents searchable organization members with
  reusable displays and presentation-only row actions.

Settings forms are currently presentation-only. They validate against protocol
DTOs but do not call mutations until their interaction design is finalized.

The remaining main and settings sidebar destinations render an empty
`DashboardPage` placeholder until their feature UI is implemented.

Shared page and section composition should use `DashboardPage`,
`HeadingGroup.Title`/`Description`, and `DashboardCard` rows/fields so route
layouts retain the same hierarchy without duplicating structural styles.
Use `DashboardCard.FieldLabel` to group a field label with its validation error;
the control remains in the right column and both columns stay top-aligned.

## Adding frontend behavior

1. Add or reuse a typed client atom in `src/atoms/<feature>/`. Keep query atoms,
   mutation atoms, and hierarchical invalidation keys outside components.
2. Adapt atoms to React in `src/hooks/<feature>/` with the shared `toQuery` and
   `toMutation` helpers. Components should consume domain hooks, not construct
   clients.
3. Prefetch protected route data in the TanStack loader with
   `prefetchQuery(context.atomRegistry, atom, abortSignal)`. The loader and
   rendered hooks must use the same registry.
4. Keep the route declaration small and render route-owned UI from its adjacent
   `-components/` directory. Shared components remain in `src/components/`.
5. Treat frontend guards as navigation UX only; the server remains authoritative
   for authentication and permissions.

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
- Use React Hook Form with the existing protocol DTO schema when the form maps
  to an API operation. Create an adjacent Effect schema only for presentation-only
  forms without a shared contract. Adapt Effect v4 schemas through
  `Schema.toStandardSchemaV1` and `@hookform/resolvers/standard-schema`, and
  connect controlled UIKit fields with `useController`.
- Keep route files small: declare the TanStack route and render a component from
  the nearest `-components/` directory. Do not create one-file component folders.
- Use Motion for restrained state transitions and microinteractions. Respect
  reduced-motion preferences and do not animate UIKit components internally.
- Use `usehooks-ts` for established reusable browser behaviors such as
  debouncing, media queries, and stepped state. Keep one-off local state local.
- Keep route loaders and rendered queries on the same router-owned atom
  registry so prefetched values are reused.
- Put required `VITE_*` values in `src/env.ts` and decode them at startup. Do not
  read `import.meta.env` throughout feature code.

### Auto-saving forms

Use `useAutoSave` with React Hook Form for profile, organization, and other
editable settings. It validates and saves two seconds after the latest change,
serializes overlapping saves, marks the submitted values as the new form
baseline, and shows shared UIKit toasts. TanStack Router navigation waits for a
dirty form to save; validation or delivery failures keep the user on the page.
Browser unloads use the native dirty-form warning because ordinary asynchronous
requests cannot be guaranteed after a tab closes.

```tsx
const form = useForm<ProfileInput, unknown, ProfileOutput>({
  defaultValues: profile,
  resolver: standardSchemaResolver(ProfileValidator),
});
const updateUser = useUpdateUser();

const autoSave = useAutoSave({
  form,
  onSave: (profile) => updateUser.mutateAsync({ payload: profile }),
});
```

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
