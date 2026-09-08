# @namera-ai/dashboard

Namera's browser dashboard. It uses Vite, React, TanStack Router, Tailwind CSS,
and the shared `@namera-ai/ui` component package.

See [Dashboard architecture](../../architecture/frontend/dashboard.md) for the
cross-route data flow, shared UI ownership, and implemented product surfaces.
The workspace-level boundary is documented in
[delivery workspace architecture](../../architecture/packages/delivery.md).

Dashboard-local imports use the `@/` alias for `src/` and omit file extensions.
Workspace package imports continue to use their package names.

## Structure

- `src/routes/` — file-based TanStack Router routes.
- `src/routes/_authenticated/` — pathless protected layout and all authenticated
  routes. Its loader prefetches the current actor into the shared atom registry,
  exposes that actor as route loader data, and redirects a missing actor to
  `/auth`. The frontend current-user atom maps only `Unauthorized` to `null`.
  Transport failures, server errors, and defects propagate to the router error
  boundary rather than redirecting an authenticated browser to sign-in.
  The current-user atom revalidates when the document becomes visible. Confirmed
  authority changes clear protected state and reload route capabilities; normal
  profile refreshes do not reset dirty values when server values are unchanged.
- `src/routes/**/-components/` — UI used by one route or route group. Keep a
  single-file component directly in this directory. Give it a folder with an
  `index.tsx` entry only after it is split across multiple files.
- `src/components/` — components shared by unrelated routes. Do not move route-only
  components here.
- `src/components/session-keys-table/` — the shared organization or wallet-scoped
  session-key table, with query-specific wrappers around one table body and a
  separate declarative column module.
- `src/components/common/table/` — shared table controls and pure collection
  helpers for facet counts, unique values, and controlled selections.
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

Vite adds `namera-source` to its default client resolution conditions; it must
retain `browser` so dependencies do not resolve Node-only transports. Browser
EVM imports use the `chains` and lazily loaded `session-review` subpaths, not the
server root service. This keeps provider configuration and test layers out of
the client bundle without duplicating account review logic.

## Authentication routes

- `/auth` contains the magic-link request UI.
- `/auth/verify` contains the browser-session confirmation UI.
- `/invitations/$invitationId` is an authenticated, sidebar-free invitation
  review flow. Logged-out users return there after magic-link sign-in. A signed-in
  user whose email does not match the invitation is logged out before being sent
  through the same sign-in flow.
- `/oauth/authorize?requestId=...` is the sidebar-free MCP OAuth consent flow.
- `/cli/authorize?user_code=...` is the sidebar-free CLI device consent flow.
  It claims the short user code for the signed-in user and requires explicit
  active session-key grants.
  It preserves the full URL through sign-in, presents the CLI and Namera as a
  connected identity pair, translates scopes into human-readable capabilities,
  shows device and verification details, and requires an explicit
  active-session-key selection before approval.

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
the supported email preference topics. `/inbox` renders the cursor-paginated
notification feed as a searchable, filterable rail with typed rich detail
views, read-state mutations, mark-all-read, archive actions, and a responsive
list-to-detail layout. Its default view is newest-first over the last seven days;
the loaded cursor pages can additionally be filtered by status, recipient scope,
category, and exact notification type.

Wallet list, detail, and creation atoms/hooks are available under
`src/atoms/wallet` and `src/hooks/wallet`. They share the wallet query-key
family and refresh when the active organization changes. `/accounts` prefetches
the active organization's wallets and presents them through a sortable,
filterable, non-resizable DataGrid with configurable visible columns. `/accounts/new`
creates a user-owned passkey EVM smart account using the shared wallet DTO while
presenting wallet terminology as "account" in the UI. The route and the Accounts
header action derive visibility from `wallet:create`; the server remains the
authoritative permission boundary. EVM address displays resolve mainnet ENS names
and avatars, fall back to a deterministic DiceBear Glass avatar when needed, and
copy the full address while retaining it in an accessible tooltip.
The account list starts with Active as its baseline status view; frozen and
archived accounts remain available through the status facet without counting the
baseline as a customized filter.

`/account/$accountId` redirects to its overview and owns a shared account-detail
shell with Overview, Assets, Session Keys, and Usage navigation. The overview prefetches
the wallet detail into the shared atom registry and presents its metadata,
semantic status, namespace, implementation, protection, identifiers,
and creation date through reusable display components. Account names and row
actions in `/accounts` link to the overview.
The Assets tab prefetches every page of the account's fungible portfolio into the
shared atom registry. It presents priced portfolio totals and allocation summaries,
then renders the provider-neutral balances through a reusable searchable,
filterable, sortable, and chain-groupable asset table with explorer actions.
The Session Keys tab prefetches the wallet-scoped session-key list and renders it
through the same table used by the organization session-key page. Usage currently
retains the detail shell with focused placeholder content for its later
implementation.

Session-key create, detail, organization-list, wallet-list, and revoke atoms/hooks live
under `src/atoms/session-key` and `src/hooks/session-key`. API-key create, detail,
list, and revoke atoms/hooks live under `src/atoms/api-key` and
`src/hooks/api-key`. MCP and CLI authorization list, detail, and revoke
atoms/hooks live under `src/atoms/auth/oauth` and `src/hooks/auth/oauth`.
Session-key `operation` modules also expose owner-approval prepare/complete
mutations and a status query. These are typed data adapters, not a completed
browser approval flow by themselves. The shared `session-key-installations`
component combines them with public owner lookup, EVM reconstruction/compilation,
SDK envelope validation and SimpleWebAuthn authentication. It polls receipts before
presenting confirmation and refreshes billing/session queries at terminal states.
Both features refresh with the active organization; session-key creation also
invalidates the list for its wallet, while API-key creation invalidates the
organization API-key list.
The session creation form generates its local secp256k1 draft through the SDK,
submits only the public signer, validates returned installation configuration,
and offers an encrypted CLI export. The draft is held outside form/atom state.
Passphrase fields clear after encryption; leaving with an unsaved key requires
confirmation. A failed create response triggers a fresh wallet-session lookup
for the same public signer. Recovery requires one pending registration with
matching authority; failures retain the draft for retry. Registration is shown
as pending. The installation panel becomes
available after backup acknowledgement and also appears on overview/policies.
It supports sponsored install and removal with the owner's passkey. Approval
assertions remain in memory only. Reloads look up the active operation: owned,
unsigned sponsored approvals resume their original retry identity; signed
operations are tracked without another passkey prompt. Recovery read errors
disable approval until retried. The full browser/live-chain journey remains
unfinished.
`/session-key/$sessionKeyId` redirects to its overview and owns a shared detail
shell with Overview, Policies, and Executions navigation. The overview presents
the session key identity and its core status, account, namespace, creator,
identifier, and lifecycle metadata. Actors with `session-key:revoke` can revoke
an active key from either its overview actions or table row actions after
confirming that all active grants will also be revoked. Policies renders the persisted EVM rules as
read-only cards through the shared policy summaries; Executions intentionally
retains a focused placeholder until session-key-scoped history is available. Session
key names and row actions open the overview, and the pinned action column can
copy or revoke the session key according to its lifecycle and the actor's permissions.
Session-key tables initially show active keys; revoked keys remain available through
the status filter. MCP and CLI authorization tables follow the same active-first
default, while the members page initially shows pending invitations and keeps
completed invitation history available through its status filter.
Execution list atoms and hooks live under `src/atoms/execution` and
`src/hooks/execution`. `/activity` prefetches the newest confirmed execution
history and renders the reusable `components/executions-table` grid with linked
wallet and session-key identities, namespace and chain displays, initiating
actor type, explorer-aware transaction hashes, execution timestamps, and copy
actions. The grid supports search, controlled sorting, display properties,
multi-select facets, and grouping by account, session key, namespace, chain, or
actor. The same component is ready for future account- and session-key-scoped
history once those backend query boundaries exist. Execution and session-key
tables keep columns, cells, sorting, and grouping row contracts separate from
their query, filtering, and view state.
Activity facet choices come from organization wallet/session-key queries and the
supported EVM chain and actor registries, so filtering remains useful before the
organization has a confirmed execution.
The session-key policy catalog declares singleton or repeatable cardinality per
policy. The picker disables only an already-added singleton and uses stable
React Hook Form field identities for repeatable instances.
Shared EVM policy components under `src/components/policy/evm/` own the policy
catalog, summaries, cards, and editors. Session-key creation supports time
windows, execution-and-signature chain allowlists, shared-amount multi-network
native-spend allowances scoped per operation, UTC hour/day/week/month, or
session-key lifetime, per-chain native gas-cost budgets for UTC hour/day/week or
lifetime, and message or EIP-712 typed-data signature permissions without
duplicating their presentation in the route. Chain-based editors share one
bounded multi-select with network icons and derived select-all state.

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
- `/settings/workspace/api-keys` presents organization API keys with creator,
  grant count, status, expiration, and creation details. Its creation dialog
  validates the shared API-key DTO, grants one or more active session keys,
  requires a 7-, 30-, or 90-day duration, and exposes the raw credential exactly
  once after creation. Actors with `api-key:revoke` can revoke an active key from
  its row action after confirming that all of its session-key grants will also
  be revoked.
- `/settings/workspace/mcp` presents local CLI MCP setup instructions and a searchable,
  status-filtered authorization table. Active authorizations are shown by
  default, and actors with `mcp-authorization:revoke` can revoke an active
  client's session-key grants after confirmation. The former `/mcp` route
  redirects here. Setup uses the configured API origin and the loopback MCP URL,
  shared copy controls, and explains encrypted key import, separate OAuth consent,
  and reauthorization after restarting the local listener.
- `/settings/workspace/cli-authorizations` presents a searchable,
  status-filtered list of authorized CLI devices. Active authorizations are
  shown by default, and actors with `cli-authorization:revoke` can revoke an
  active device's session-key grants after confirmation.
- `/settings/workspace/billings` presents the active plan in a compact included-
  allowance checklist and the organization-anniversary reset date beside live
  usage meters from the billing API. It reads through the shared billing atom
  and is visible to actors with `billing:read`.

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

Unimplemented Identity and Templates routes are excluded from the beta route
tree and sidebar. Their former URLs reach the shared not-found boundary rather
than an empty page.

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

Mutation hooks accept TanStack-style lifecycle callbacks. Use `mutate` from UI
events and forms so expected failures are handled once by the hook callbacks;
do not add a `try/catch` to every submit handler. Use `mutateAsync` only when a
workflow must await or serialize the operation, such as auto-save.

```tsx
const updateUser = useUpdateUser({
  onSuccess: () => showSuccessToast({ title: "Profile saved" }),
  onError: (error) =>
    showErrorToast(error, {
      title: "Couldn’t save profile",
      description: "Review your details and try again.",
    }),
});

const onSubmit = form.handleSubmit((payload) => {
  updateUser.mutate({ payload });
});
```

`src/lib/error-messages.ts` maps known API tags and codes to concise user-facing
feedback. Add one registry entry when an error needs specific wording; use the
operation fallback for errors that do not. `src/lib/toasts.ts` is the only toast
presentation boundary. Titles state the outcome, while descriptions add one
short useful detail only when needed.

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
Flushes only run while the form's original user/session/workspace/role authority
still matches the current actor, with a second check after asynchronous validation.
The authenticated layout clears cached state and reloads route permissions when
session revalidation observes an authority change; affected forms are unmounted.

When loader data replaces a mounted form, call both
`form.reset(nextValue)` and `autoSave.resetBaseline(nextValue)`.
Use the same form-value normalization for initialization and reset. In particular,
the profile supplies its displayed default avatar rather than registering an
explicit undefined image, which is not valid for the protocol's optional-key field.
Workspace settings similarly supplies its displayed fallback logo before a
name-only edit; initialization and reset share `workspaceFormValues`.

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

### Document security

`tooling/document-security.ts` owns the dashboard CSP and browser permissions.
Production HTML carries a meta CSP restricting scripts to this origin and
connections to this origin plus `VITE_API_URL`'s origin. Inline styles remain
allowed for UIKit, charts and Motion; inline scripts and eval are not allowed.
Images may use HTTPS, data and blob URLs. Passkey creation/authentication is
limited to this origin by Permissions-Policy.

Builds emit `dist/_headers` for static hosts supporting that format. Other hosts
must apply its values to dashboard responses explicitly. Vite preview sends
these headers for local production verification; development sends the same
non-CSP headers but omits CSP for HMR. A meta policy alone cannot enforce framing
or Permissions-Policy. Do not mark the hosting boundary verified until response
headers have been checked on the actual dashboard origin.

| Variable                         | Required | Description                          |
| -------------------------------- | -------- | ------------------------------------ |
| `VITE_API_URL`                   | Yes      | Namera API and telemetry proxy base. |
| `VITE_TELEMETRY_SERVICE_VERSION` | No       | Browser telemetry service version.   |

The browser Effect runtime exports protobuf OTLP traces, logs, and metrics to
the server-owned `/t/traces/v1`, `/t/logs/v1`, and `/t/metrics/v1` proxies.
Browser code never receives the LGTM or Axiom destination credentials.

## Commands

`tests/unit` covers frontend form boundaries through the actual resolver. It
does not replace browser journeys or server authorization tests.
Vitest resolves the same `@/` TypeScript paths as Vite so these tests can import
the actual shared form schemas. Optional descriptions are normalized by
`src/lib/form-description.ts`; do not pass an empty string directly to a
nonempty optional-key protocol field.

```sh
pnpm --filter @namera-ai/dashboard dev
pnpm --filter @namera-ai/dashboard generate-routes
pnpm --filter @namera-ai/dashboard typecheck
pnpm --filter @namera-ai/dashboard typecheck:test
pnpm --filter @namera-ai/dashboard test
pnpm --filter @namera-ai/dashboard build
```
