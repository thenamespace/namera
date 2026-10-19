# Dashboard

The dashboard is a Vite React SPA with TanStack Router, Effect Atom, React Hook
Form, and shared Namera UI. It talks to the server with the HttpOnly browser
session; it has no database connection or server credential.

## Data and authority

Route loaders and React hooks use the same router-owned atom registry. Loaders
prefetch required data; query atoms own HTTP requests and cache keys, and domain
hooks expose query state and mutation callbacks. Mutations invalidate the owning
query family. Account and workspace IDs remain part of query identity.

The protected layout resolves the current actor before rendering. Only an
authentication rejection becomes a sign-in redirect; other failures render retry
feedback. A confirmed change to user, session, workspace, membership, role, or
permissions resets protected cache state and reloads route capabilities. Profile
presentation changes do not discard dirty forms. There is no server-pushed
authority-change channel.

UI permission guards hide unavailable actions, but the server authorizes every
request. Optional data is prefetched only with its read permission. Denied queries
do not keep showing cached protected data; ordinary network failures may retain it.

## User workflows

Normal dashboard sign-in defaults to `/get-started`; explicit invitation and
OAuth/CLI return paths keep their destination. The checklist links to existing
account, session-key and MCP setup screens. The guided path focuses on AI clients,
with copyable starter prompts for message signing and transactions. Overview remains accessible.
The connection step embeds CLI installation, a selector for Claude Code, Codex,
and Gemini CLI with copyable stdio registration commands, and a read-only discovery
prompt. Client commands share their definitions with MCP settings. The prompt uses the existing
first-tool-call browser authorization flow; users approve then retry the request.
Copying setup commands does not complete the connection milestone.
Its four workspace milestones use the existing overview and permission-gated
API-key/CLI/MCP lists: an account, a session key, an integration with `lastUsedAt`
(or a confirmed non-user execution), and a confirmed execution or successful
signature. Session-key creation does not imply network installation. Merely
creating an API key, opening a guide or submitting a pending transaction does not
complete the corresponding milestone.

Account creation started from the checklist carries `from=get-started` through
the creation form and success page. That success page offers Continue setup
alongside View account; returning to the checklist selects the next unfinished
step from the refreshed workspace data. Ordinary account creation keeps its
existing actions. The source parameter is an allowlisted navigation hint only.

The checklist’s session-key action carries `preset=get-started` and
`from=get-started`. Once accounts load, the creation page consumes the preset with a history replace
and retains the preset in page state. It selects the newest active account that
supports session keys and prefills a managed key on Base with a 30-day lifetime,
message signatures, and unrestricted account access. Form defaults are applied
once; consuming the parameter and later revalidation preserve edits. Ordinary
creation and recipe defaults are unchanged. Creation still requires explicit
submission and the existing owner approval for network installation. Browser
tests cover preset consumption, validation without edits, and the submitted scope.
The source hint stays in the URL after preset consumption and follows managed
activation or local-key setup to the success page, including Skip for now. That
page offers Continue setup alongside View session key. A source hint alone does
not reapply the preset. Ordinary creation keeps its existing success actions,
and neither navigation parameter is sent in the creation request.

Progress shares the router atom registry and refreshes every 30 seconds and on
window focus while the checklist is open. Failed checks expose retry feedback;
denied queries revalidate session authority. The existing overview requires
wallet, session-key, execution and billing read permissions; roles without those
permissions keep their normal landing page and do not fetch onboarding data.
Optional connection lists require their own read permission.

All four milestones enable an explicit Done action. It saves a versioned boolean
in browser local storage, scoped to user and workspace, then removes the sidebar
entry and returns to Overview. Direct visits after dismissal also return to
Overview. Dismissal does not sync between devices and resets if browser storage
is cleared. No backend route or persistence schema was added. Browser tests cover
step/illustration selection, keyboard controls, real connection usage, permission
gates, and dismissal across the page and sidebar. The illustrations use local
SVG/CSS textures and respect reduced motion.

| Surface      | Responsibility                                                               |
| ------------ | ---------------------------------------------------------------------------- |
| Accounts     | Creation, owner details, portfolio, session keys, execution history          |
| Session keys | Local/managed creation, policy composition, network installation, revocation |
| Templates    | Recipe-driven session creation through the same approval flow                |
| Identity     | ENS records, primary-name transactions, avatar/header uploads                |
| Inbox        | Cursor-paginated notifications, search, filters, read/archive actions        |
| Settings     | Profile, sessions, workspace membership, API/OAuth access, billing           |
| Consent      | Browser review for OAuth and CLI device authorization                        |

Session-key table groups use wallet IDs, not account names. Inbox defaults to a
seven-day view; All time removes the cutoff on loaded pages, not pagination.
Templates retain `/recipes` route paths and use the private recipes package.

## Forms and confirmations

Forms use React Hook Form with Effect Schema through the Standard Schema resolver.
The server remains the validation boundary. Domain mutation hooks expose
`onSuccess`, `onError`, and `onSettled`; shared feedback maps typed errors to toasts.
Session-key creation keeps Create available for incomplete forms and runs the
shared resolver on submission. The Add policy picker groups its six choices into
Account access, Limits, and Signing; search includes the group names and hides
empty groups. Missing permissions show inline errors after submission, without
an upfront hint box. Failed submission reveals and focuses the first
invalid network, with inline validation messages. Create is disabled during
submission; unfinished policy edits, resource limits, and uncertain managed
creation show explicit blockers and cannot dispatch a creation request.

Settings autosave debounces edits, serializes saves, and checks captured authority
before dispatch, including an unmount/pagehide flush. Read-only forms disable
autosave. A request already accepted by the server cannot be cancelled by unmounting.

`TransactionOverview` presents rich review rows and confirmation actions. The
owning hook prepares and verifies requests, handles cancellation, signs, submits,
and polls. The modal itself neither authorizes nor submits a transaction. Receipt
confirmation, not an optimistic UI update, activates a session installation.
Pending reviews expose their busy state on the dialog element and disable actions
and dismissal. Shared copy controls use the button itself as the tooltip trigger,
with one tab stop and keyboard activation.

Local session private keys stay in creation memory until encrypted export. Managed
creation retains an idempotency key scoped to organization, user, purpose, and payload; it does not
persist secret form values. Identity image previews remain local until confirmation.

API-key creation cannot be dismissed while its request is pending. Its one-time
secret is shown and copied only for the still-active submission; closing the
dialog or leaving the page invalidates that response target. A late success does
not populate a later dialog or modify the clipboard. Leaving the page does not
cancel a creation already accepted by the server.

## Browser boundary

Route-owned UI lives in adjacent `-components` directories. Cross-route components
stay in the dashboard; cross-app presentation belongs in `@namera-ai/ui`.
Browser EVM code imports the chain metadata and session-review subpaths rather
than the server service barrel. Browser OTLP uses the server proxy.

Build tooling emits CSP and other document headers for nginx and Vite preview.
Private routes are noindex; account names belong in browser titles, not public
social metadata. Static hosting must serve the generated response headers.

## Source

- [Protected layout](../../apps/dashboard/src/routes/_authenticated/route.tsx)
- [Session boundary](../../apps/dashboard/src/routes/_authenticated/-components/session-boundary.tsx)
- [Atoms](../../apps/dashboard/src/atoms) and [hooks](../../apps/dashboard/src/hooks)
- [Shared confirmation](../../apps/dashboard/src/components/transaction-overview.tsx)
- [Document security](../../apps/dashboard/tooling/document-security.ts)
