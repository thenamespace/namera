# Dashboard architecture

The dashboard is a Vite/React application using TanStack Router, Effect Atom,
React Hook Form, Tailwind CSS, Motion, Wagmi, and `@namera-ai/ui`.

## Data flow

```mermaid
flowchart LR
  Loader[TanStack route loader] --> Registry[Router-owned Effect Atom registry]
  Registry --> API[Typed API atoms]
  Hook[React domain hook] --> Registry
  Component --> Hook
  API --> Server[Namera API]
```

Protected loaders prefetch the data a route needs and return it as initial route
data. Rendered hooks observe the same atom cache, so mutations update the screen
without a second state system. Query keys include active organization where
scope changes with tenant selection.

## Routing and authentication

All product routes live below the pathless `_authenticated` layout. Its loader
prefetches the current actor and redirects a missing actor to `/auth`. Auth,
invitation review, OAuth consent, CLI consent, and workspace creation use
sidebar-free layouts where appropriate. `/auth/verify` explicitly exchanges the
credential then replaces location with the server-approved return path.

Account, session-key, and execution detail parents validate branded IDs,
prefetch detail once, map missing resources to the router not-found boundary,
and provide nested navigation.

## State and mutations

- Atoms own typed API calls, query keys, invalidation, and loader-prefetch
  helpers.
- Hooks adapt atoms through shared query/mutation helpers and expose
  `onSuccess`, `onError`, and `onSettled` callbacks.
- Components use `mutate` and the shared feedback registry for expected
  failures. `mutateAsync` is reserved for sequencing such as serialized
  autosave.
- Active-organization changes invalidate tenant-scoped wallet, key,
  authorization, member, billing, and execution data.

## Forms

Forms use one Effect Schema converted with `Schema.toStandardSchemaV1`, the
standard-schema React Hook Form resolver, a native `form`, `Controller`, and
UIKit `Field` primitives. UIKit selection controls adapt value/change props
explicitly. Permission-aware route data decides whether a form is interactive;
read-only forms do not autosave or block navigation.

## Shared UI ownership

- `src/routes/**/-components`: one route or route-group composition.
- `src/components`: UI shared by unrelated routes.
- `src/components/common/table`: compact filter/order/group/display controls and
  pure facet helpers.
- `src/components/display`: semantic wallet, address, chain, actor, status,
  metadata, date, and copy displays.
- `src/components/policy/evm`: policy catalog, cards, summaries, and editors.
- `@namera-ai/ui`: cross-application primitives, icons, hooks, and theme.

Shared copy controls transition to a check state with reduced-motion support.
Tooltip exits hide as soon as an anchor is released, avoiding detached overlays
at the viewport origin. Interactive controls retain accessible names and
keyboard/focus behavior.

## Tables

Reusable fixed-column data grids separate declarative columns/cells/sorters from
query and view state. Accounts, session keys, API keys, invitations, members,
and executions share compact controls where the domain needs them. Active rows
are the default for revocable resources; lifecycle history remains available in
status filters. Columns stretch to full width with minimum sizes and are not
resizable. Pinned action columns contain navigation and copy/revoke actions.

Execution and session-key tables are reusable across organization, account, and
session-key scoped routes. Scoped usage pages prefetch server-filtered history
and remove redundant filter/grouping facets. List endpoints intentionally
return compact row contracts; detail pages load expanded relations.

## Implemented product routes

- organization overview with compact resource KPIs, namespace operation totals,
  configurable activity trends, and a shared recent-executions summary;
- magic-link sign-in and invitation recipient review;
- accounts list/create and account Overview/Session Keys/Usage views;
- session-key list/create/revoke and Overview/Policies/Usage views;
- activity list and expanded execution detail;
- profile, notification preferences, sessions/security, workspace, members and
  invitations, API keys, MCP authorizations, CLI authorizations, and billing
  usage;
- MCP and CLI authorization consent with account-grouped active session-key
  selection.

## Browser telemetry

The shared atom runtime installs the dashboard OTLP Layer. The browser exports
only through server `/t/*` endpoints with a dashboard service identity; provider
credentials never enter the bundle.

## Organization overview

The authenticated index route prefetches `GET /dashboard/overview` into the
router-owned atom registry, while its component subscribes to the same atom so
the page shell remains visible during refreshes. The response keeps global
resource totals at the root and places operation totals, activity, and execution
source distribution inside a namespace-discriminated array. Each namespace
provides daily, weekly, and monthly series; `eip155` currently returns 14 daily,
12 weekly, and 12 monthly buckets plus confirmed execution counts grouped by
bounded actor type. A future Solana member can be added without changing the
page-level contract.

The overview deliberately excludes plan limits, remaining quotas, and attention
states. Four independent KPI cards summarize accounts, active session keys,
all-time executions, and all-time signatures. Actual active-resource ratios and
recent operation trends provide context without representing billing quotas.
The primary chart compares executions and signatures at the selected
granularity, while the execution-source chart shows the API key, MCP, CLI, and
member composition for confirmed executions. Limits and period consumption
belong to Billing, while recent activity
subscribes to the same executions atom as the Activity page and renders the
shared execution table in a five-row summary mode. The overview always renders
the active organization's live projections.

## Pending

- Build notification inbox, audit history, and remaining asset/identity/template
  product surfaces as their backend contracts stabilize.
- Add browser interaction and accessibility regression tests.
- Measure route/chunk splitting before optimizing large bundles.
