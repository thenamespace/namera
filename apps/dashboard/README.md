# @namera-ai/dashboard

Namera's browser dashboard. It uses Vite, React, TanStack Router, Tailwind CSS,
and the shared `@namera-ai/ui` component package.

Dashboard-local imports use the `@/` alias for `src/` and omit file extensions.
Workspace package imports continue to use their package names.

## Structure

- `src/routes/` — file-based TanStack Router routes.
- `src/routes/_authenticated/` — pathless protected layout and all authenticated
  routes. Its loader prefetches the current actor into the shared atom registry,
  exposes that actor as route loader data, and redirects a missing actor to
  `/auth`. The frontend current-user atom recovers any API or transport failure
  to `null`.
- `src/routes/**/-components/` — UI used by one route or route group. Keep a
  single-file component directly in this directory. Give it a folder with an
  `index.tsx` entry only after it is split across multiple files.
- `src/components/` — components shared by unrelated routes. Do not move route-only
  components here.
- `src/components/display/` — reusable compact value renderers for metadata,
  email addresses, dates, roles, and future table cells.
- `src/atoms/` — typed API query and mutation atoms, invalidation keys, and loader prefetching.
- `src/hooks/` — React Atom adapters and domain hooks.
- `src/lib/wagmi.ts` — shared Wagmi chain and RPC transport configuration.
- `src/telemetry.ts` — browser OTLP layer and the shared Effect Atom runtime.
- `src/env.ts` — required browser environment decoded synchronously with Effect Config.
- `src/router.tsx` — router construction.
- `src/router-context.ts` — services shared by route loaders and the rendered application.
- `src/routeTree.gen.ts` — generated route tree; do not edit manually.
- `src/styles.css` — application stylesheet entry importing Namera UI styles.
- `vite.config.ts` — Vite, Router, React, Tailwind, and devtools plugins.

## Authentication routes

- `/auth` contains the magic-link request UI.
- `/auth/verify` contains the browser-session confirmation UI.
- `/invitations/$invitationId` is an authenticated, sidebar-free invitation
  review flow. Logged-out users return there after magic-link sign-in. A signed-in
  user whose email does not match the invitation is logged out before being sent
  through the same sign-in flow.

The shared auth layout prefetches the current user and redirects an already
authenticated browser to `/`.

The request flow uses one React Hook Form instance across its steps, validates
with the protocol request DTO, preserves a validated application-relative return
path, and advances only after the request mutation succeeds. The verification
route validates its URL credentials with the protocol schema, creates the
cookie-backed session through the verification mutation, and replaces the
browser location with the returned relative path.

Notification inbox and preference atoms/hooks are available under
`src/atoms/notification` and `src/hooks/notification`. The settings page renders
the supported email preference topics; inbox UI is not implemented yet.

Wallet list, detail, and creation atoms/hooks are available under
`src/atoms/wallet` and `src/hooks/wallet`. They share the wallet query-key
family and refresh when the active organization changes. `/accounts` prefetches
the active organization's wallets and presents them through a sortable,
filterable, resizable DataGrid with configurable visible columns. `/accounts/new`
creates a software-protected EVM smart account using the shared wallet DTO while
presenting wallet terminology as "account" in the UI. The route and the Accounts
header action derive visibility from `wallet:create`; the server remains the
authoritative permission boundary. EVM address displays resolve mainnet ENS names
and avatars, fall back to a deterministic DiceBear Glass avatar when needed, and
copy the full address while retaining it in an accessible tooltip.

## Settings routes

- `/settings/profile` contains the React Hook Form profile presentation. Data
  loads from the current actor and autosaves name and image updates.
- `/settings/notifications` contains grouped product, account, and organization
  email preference forms backed by the notification preference DTO.
- `/settings/security` presents active sessions through the session query. It
  supports logout and revoking other sessions.
- `/settings/workspace` contains the organization logo and name form backed by
  the organization update DTO.
- `/settings/workspace/members` presents queried, searchable organization
  members with reusable displays, role updates, removal, and an invitation
  dialog validated against the shared invitation DTO. Its loader and rendered
  queries fetch role and invitation data only when the current actor has the
  corresponding read permission, so read-only members can still view the member
  list.

Each settings route loader prefetches the data required by that page into the
shared Effect atom registry and returns it as route data. Forms and tables use
that loader data for their initial render while hooks observe the same cache for
mutation refreshes. Workspace settings routes are grouped under
`src/routes/_authenticated/settings/workspace/`.

Use `hasPermissions` for non-React permission decisions and `PermissionGuard`
for conditional UI. These are presentation guards only; the server remains
authoritative. Use the shared `PermissionDenied` state when an authenticated
route is visible but the actor cannot access its operation. Role selectors must
use the assignable-roles endpoint instead of reproducing role hierarchy rules in
the dashboard.

### Permission-aware settings

- Derive edit capability from the current actor in the route loader using the
  same permission required by the mutation endpoint. Return that capability with
  the prefetched data instead of discovering authorization through a failed
  mutation.
- Fetch optional role, invitation, billing, or administration data only when the
  actor has its read permission. A forbidden optional query must not prevent the
  rest of a page from loading.
- Render interactive inputs only when the actor can update the value. Otherwise,
  render the value with `ReadOnlyInput`, which applies UIKit `inputVariants` to a
  non-interactive element, or use the corresponding non-interactive preview for
  richer values such as metadata icons.
- Pass the same capability to `useAutoSave({ enabled })` and guard the form submit
  handler. Read-only forms must not register navigation blocking or send update
  mutations.
- Hide mutation-only dialogs and row actions unless the actor has the exact
  required permission. Permission-gated components improve UX only; every server
  handler must still enforce authorization.
- Personal profile and notification-preference forms remain editable because
  their endpoints operate on the authenticated user and do not use organization
  role permissions.

`/workspace/new` is an authenticated, sidebar-free workspace creation flow. It
validates against `CreateOrganizationRequest`, creates and activates the new
workspace through the existing organization operation, then navigates home.

The remaining main and settings sidebar destinations render an empty
`DashboardPage` placeholder until their feature UI is implemented.

Shared page and section composition should use `DashboardPage`,
`HeadingGroup.Title`/`Description`, and the individual `DashboardCardRoot`,
`DashboardCardContent`, and `DashboardCardRow` components so route layouts retain
the same hierarchy without duplicating structural styles. Form semantics belong
to the shared `Field` components rather than the dashboard card.

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

All authenticated pages belong beneath the pathless `_authenticated` route.
Child loaders may prefetch `currentUserAtom` when they need the actor to derive
another query; the shared registry reuses the parent loader result. Return the
page's required values as route data rather than starting its initial fetch in
the rendered component.

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
  `Schema.toStandardSchemaV1` and `@hookform/resolvers/standard-schema`.
- Use a native `<form id="..." noValidate>` with `form.handleSubmit`. Group its
  controls with `FieldGroup`, and render every registered control through React
  Hook Form's `Controller` using individual `Field`, `FieldLabel`, `Input` or
  another UIKit control, and conditional `FieldError` components. Pass
  `data-invalid` to `Field` and `aria-invalid` to native inputs. Spread `field`
  onto native inputs; map `selectedKey`/`onSelectionChange`,
  `isSelected`/`onChange`, or `value`/`setValue` explicitly for non-native UIKit
  controls. Give submit buttons `type="submit"` and the matching `form` ID.
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

Use `useAutoSave` with React Hook Form for profile, organization, notification
preferences, and other editable settings. It subscribes to form values and uses
a trailing three-second debounce: every edit clears and restarts the timer, so
the mutation runs only after the user stops editing. It serializes overlapping
saves by rerunning after the active save completes. It exposes
`idle`, `saving`, `saved`, and `error` status plus `resetBaseline` for server data
replacements. It also makes a best-effort silent flush of dirty values on route
unmount and `pagehide`, including when navigation happens before the debounce.

When loader data replaces a mounted form, call both
`form.reset(nextValue)` and `autoSave.resetBaseline(nextValue)`.

```tsx
const form = useForm<ProfileInput, unknown, ProfileOutput>({
  defaultValues: profile,
  resolver: standardSchemaResolver(ProfileValidator),
});
const updateUser = useUpdateUser();

const autoSave = useAutoSave({
  form,
  onSave: async (profile) => {
    await updateUser.mutateAsync({ payload: profile });
  },
});
```

Pass `enabled: false` for a read-only form. This prevents queued saves and
unmount/pagehide flushes in addition to replacing its interactive controls with
read-only presentation.

## Environment

| Variable                         | Required | Description                          |
| -------------------------------- | -------- | ------------------------------------ |
| `VITE_API_URL`                   | Yes      | Namera API and telemetry proxy base. |
| `VITE_TELEMETRY_SERVICE_VERSION` | No       | Browser telemetry service version.   |

The browser Effect runtime exports protobuf OTLP traces, logs, and metrics to
the server-owned `/t/traces/v1`, `/t/logs/v1`, and `/t/metrics/v1` proxies.
Browser code never receives the LGTM or Axiom destination credentials.

## Commands

```sh
pnpm --filter @namera-ai/dashboard dev
pnpm --filter @namera-ai/dashboard generate-routes
pnpm --filter @namera-ai/dashboard typecheck
pnpm --filter @namera-ai/dashboard build
```
