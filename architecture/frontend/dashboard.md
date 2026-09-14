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

Session bootstrap maps only the typed `Unauthorized` response to a missing
actor. Offline, server, permission, and decoding failures remain errors and
reach the retry boundary; they must not masquerade as a successful logout.

Account, session-key, and execution detail parents validate branded IDs,
prefetch detail once, and provide nested navigation. Invalid IDs use the router
not-found boundary. Account and session-key detail query failures render a local
`DataError` with atom refresh inside their shells, rather than leaving nested
pages loading indefinitely. Retry is disabled while that query is refreshing;
provider exception details are never displayed.

The router has shared error and not-found fallbacks. Errors expose a reload
action (clearing failed in-memory atom results), and both states offer a return
to the overview. They never render exception messages or request URLs. A child
route failure stays in that route's boundary under its loaded parent layout;
failure of the authentication layout itself cannot retain that layout's sidebar.
Component-owned query errors still need their own local feedback states.
Accounts, organization/account session keys, executions, API keys, CLI/MCP
authorizations, invitations, members/assignable roles and login sessions use the
shared compact `DataError` with the owning query's refresh action. Retry is
disabled during the request and preserves table filters and already-loaded rows.
Production-preview Chromium verifies failure then successful local retry on
Accounts, Session Keys and Activity while the sidebar remains mounted. These are
transport-intercepted browser checks, not provider outage certification.
Execution details, workspace settings, notification preferences and session-key
creation also use local retry feedback when their initial data request fails.
Already-loaded form data is retained on background refresh failure so unsaved
edits are not discarded.
The shared query adapter makes an exception for typed `Unauthorized` and
`Forbidden` failures: it exposes no cached data for that denied result, including
while retrying it. Initial loading and ordinary network/server errors retain
their existing behavior. This is a presentation safeguard, not cache erasure or
an authorization boundary. Denied queries and mutations trigger a shared
current-user refresh so atom-based permission guards receive the latest role or
signed-out result. The bootstrap query cannot invalidate itself; temporary
transport/server failures do not request session revalidation.

The authenticated layout compares the observed actor with its loaded authority
(user, session, organization, membership, role and sorted permissions). A change
hides and unmounts the protected content, resets the atom registry and invalidates
route loaders. A missing actor redirects to sign-in; changed permissions reload
read-only/edit capabilities. The boundary is keyed by loaded authority so its
session subscription is reattached after registry reset. Profile presentation
changes do not discard forms. Autosave captures its original authority and checks
it before validation and again before dispatch, including unmount/pagehide flushes.
These guards do not cancel writes already accepted by the server or replace
server-side authorization. The shared current-user atom refreshes when the
document becomes visible using Effect's focus signal. There is no push
notification of remote role changes; the transition runs when revalidation
observes them. An unchanged profile refresh does not reset dirty form values.

Production-preview Chromium verification used a real signed-in development
session with intercepted 403/401 and changed-role responses. A denied workspace
save caused a read-only reload with one write attempt; a subsequent denied MCP
query in the same page lifecycle redirected to sign-in and removed the protected
sidebar. This covers frontend transitions, not live server role mutation (covered
separately by HTTP integration tests).

A second production-preview Chromium check changed the active workspace through
the real API while its old settings form was dirty, then dispatched the document
visibility event. No update request was sent, both workspace names remained
unchanged in the API, and the new workspace's form rendered. Switching back
through the sidebar restored the original account list. The same browser check
verifies that returning to the tab retains an unsaved profile name when the
server profile has not changed. Visibility is triggered by the test rather than
requiring an operating-system window switch.

Workspace form initialization/reset supplies the displayed fallback logo when
metadata has none. Otherwise React Hook Form registers an explicit undefined
logo and the optional-key request schema blocks name-only saves. Resolver tests
cover missing logos and preservation of existing logo/description values.

Profile form initialization and refresh normalize absent avatar/name fields to
controlled values. React Hook Form otherwise introduces an explicit undefined
avatar, which the optional-key protocol schema rejects and prevents autosave.
The default avatar matches the displayed fallback and is persisted with the
first profile edit. Avatar validation errors are visible. Resolver regressions
cover an image-free profile and preservation of an existing image.

Account and session-key creation share `OptionalFormDescription`: an empty or
undefined controlled description decodes to an absent key before reaching the
strict public DTO. Nonempty text retains the protocol length checks. The account
textarea keeps an empty string when cleared; neither creation flow requires a
description. Form resolver tests exercise blank and populated descriptions and
verify that the decoded session request can be encoded by the public API schema.

Account creation also requires a form-only recovery acknowledgement before the
passkey ceremony starts. Recovery warnings are not shown on account overviews.
The acknowledgement is not sent to the API or persisted.
Before opening registration, the dashboard sets WebAuthn `user.name` and
`user.displayName` to `<account name> - Namera`. These are password-manager display
labels only; the server-issued user handle, challenge and RP ID remain unchanged.
The RP ID comes from `AUTH_DASHBOARD_PUBLIC_ORIGIN` (hostname only), while origin
verification uses its full origin. Password managers control the final saved-item
title and website presentation; existing passkeys are not renamed by this flow.

## State and mutations

Session creation has one searchable policy picker and one card list. Each policy
appears once; the editor's bottom-left Onchain/Offchain toggle selects enforcement.
Identical contract/selector/token parameters share a mounted form, as do time
windows. Different budget/signature forms keep independent drafts while switching.
Editor titles contain only the policy name. Generic
enforcement paragraphs are omitted. Address fields disable browser text correction,
and summaries reuse the shared truncated address display with copy and tooltip.
Per-policy folders own their definitions and
specialized forms; shared field renderers are reused for matching contract and
selector shapes. Catalog metadata maps overlapping rules once. Call restrictions,
token spend, time windows, native spend, gas budgets and signatures expose both
variants. Root remains onchain-only; API network restrictions remain offchain-only,
separate from installation networks. The
existing DTO still stores API policies and onchain authorization separately.
Installation networks, optional start date, and required expiry share a row-based
card immediately after metadata, introduced by a Networks and lifetime heading
and short description. Onchain lifetime is not repeated in the policy
list; it uses the same date-only editor as API time windows and maps ISO instants
to Unix seconds. The onchain time-window picker edits these same fields.
Dates denote local midnight at the start of the selected date. Onchain signature
authority is explicitly added through the picker and is never inferred from an API
signature policy. Onchain budgets remain
cumulative per network; only API budgets support reset periods. Saving an enforcement
change replaces the original policy; cancelling leaves it unchanged. Root consent,
duplicate-target validation, and the requirement for onchain permissions remain.
Unavailable variants are disabled in the toggle; a picker entry is disabled only
when neither variant is available. Cards
expose edit/remove actions. Target-specific onchain rules can be repeated for
different addresses, but case-insensitive target duplicates across rule types
are rejected inside the editor before saving. Offchain restrictions intersect;
the token editor explicitly states that unrelated calls are blocked.

The shared session-key selector used in authorization forms counts offchain rules
plus distinct onchain permissions and explicitly enabled signature authority.
Identical copies on multiple networks count once. Mandatory network/lifetime
configuration is separate from this policy count.

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

The shared `FieldError` renders explicit resolver messages with UIKit typography
and `role="alert"`. It must not delegate to React Aria's context-dependent
`FieldError`: native inputs managed by React Hook Form do not provide that
validation context, so messages would be silently hidden. Render coverage checks
both explicit children and resolver errors outside a React Aria form.

The signature policy editor requires at least one EIP-712 rule for typed-data
selection. Each rule includes a network, verifying contract, optional exact
domain name/version, and comma-separated primary types. Its Effect form schema
converts these to the public policy contract and rejects duplicate types. Shared
summaries display each tuple and warn on existing unrestricted policies. API-only
scope and the absence of message-value limits are disclosed in the editor.

Production-preview browser verification covered empty-rule and duplicate-type
errors, keyboard toggling of exact domain matching, saving and reopening a rule,
and preserving an exact empty name. This exercised a local draft only: it did
not create or install an onchain session. Full session creation/approval journeys
remain separate gates.

Session network selection reads the EVM registry's `operationsEnabled` flag.
Paused networks remain visible with a Paused label but cannot be selected for
new sessions; Select all includes only enabled networks. The form resolver also
rejects paused networks on the network field. Policy editors retain paused
networks so existing restrictions can still be represented. The installation
panel disables new passkey approvals on paused networks without stopping receipt
polling for already signed operations, and explains that API revocation does
not remove onchain permissions. Registry state is bundled at build time; server
adapter guards remain authoritative if a browser has an older build.
Removal retry and receipt feedback distinguish uninstalling permissions from
approving a new installation; a failed removal does not restore API access.

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
The shared stylesheet excludes the document root from UIKit toast view transitions
and makes the transition overlay non-interactive, preserving page hover and cursor
state when copy feedback appears. Keyboard badges use compact outlined styling
and normal word spacing so modifier combinations remain legible. Inbox rows use
theme-backed hover/selection fills, an icon-anchored unread dot and centered empty
states with explicit typography alignment.
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

Identity and Templates are not beta features: their empty routes and the Identity
sidebar group are removed. Direct navigation uses the shared not-found boundary.

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

## Local MCP setup

MCP settings include local listener setup above the authorization table. The
start command targets the configured API origin; the agent connects to the CLI's
loopback HTTP endpoint, not a server-hosted MCP route. Instructions distinguish
MCP OAuth consent from CLI login/API keys, require local encrypted session-key
imports for signing, and disclose reauthorization after listener restarts.

## Browser telemetry

Dashboard document security is owned by `tooling/document-security.ts`, not the
API middleware. Production HTML includes a CSP fallback and no-referrer metadata;
builds emit an `_headers` file containing CSP framing denial, nosniff, frame
denial, no-referrer and a Permissions-Policy permitting first-party WebAuthn but
disabling camera, microphone, geolocation and payment. Hosts without `_headers`
support must apply those values themselves. Vite preview applies the full policy;
development omits CSP to allow HMR. Scripts must be same-origin; API/RPC/telemetry
connections may only use self and the configured API origin. Inline styles remain
necessary for the shared UI. External token/avatar images are HTTPS-only.
The document meta fallback cannot enforce `frame-ancestors` or browser permissions.
Actual hosted-header and critical-browser-journey verification remain required.

The Vite resolver preserves its default client conditions alongside
`namera-source`. Replacing those defaults can select Node transports from
browser-compatible dependencies. Dashboard chain data and owner review use
`@namera-ai/evm/chains` and `@namera-ai/evm/session-review`; they do not import the
EVM server service/configuration barrel. The production build is checked for
Node-module externalization warnings and unwanted provider configuration code.

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

- Identity, templates and audit-history browsing are future product surfaces,
  not empty beta navigation destinations. Inbox and account assets are implemented.
- Add browser interaction and accessibility regression tests.
- Measure route/chunk splitting before optimizing large bundles.
