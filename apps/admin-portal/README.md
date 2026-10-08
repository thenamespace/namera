# Namera Admin

Static Vite React application using TanStack Router, Effect atoms, and Namera
UIKit, matching the dashboard's compact sign-in experience.

## Local development

```sh
pnpm install
pnpm --filter @namera-ai/admin-portal dev
```

The portal runs at `http://localhost:3003`. Copy `.env.example` to `.env` to use
the local API. Without `VITE_API_URL`, the client uses `https://api.namera.ai`.
Configure the server's `ADMIN_CORS_ORIGIN=http://localhost:3003` and run the API.
Email delivery and Google use the server's existing provider configuration; no
provider secrets belong in this frontend. Google keeps the API callback URI,
not a portal callback URI.

## Implemented routes

- `/auth`: Google sign-in or email link/eight-digit code.
- `/auth/verify`: explicit confirmation of an emailed link; opening a link does
  not automatically consume it.
- `/`: Overview. Successful sign-in navigates here.
- `/waitlist`: Waitlist.
- `/invites`: Beta invite table, email/status filters, pagination, create and revoke dialogs.
- `/team`: Owner-only admin members table, invitations, role updates, and removal.
- `/invitations/accept`: Explicit acceptance of an emailed team invitation.
- `/activity`: Admin activity.

Protected pages use a shared UIKit inset sidebar,
active navigation, tooltips, and a responsive off-canvas menu. The page header
toggles the sidebar; UIKit also provides the `Cmd/Ctrl+B` shortcut. Navigation,
Inter typography, icons, and compact spacing follow the dashboard. These pages
other than Team and Invites remain empty scaffolds. Team uses the dashboard's DataGrid,
profile icons, copyable emails, role/status displays, date tooltips, and form dialogs.
Only operator/viewer roles can be assigned; the owner cannot be edited or removed.
Removed members remain visible as historical rows without management actions.

Invites is readable by every active admin role; owner/operator can create and
revoke codes. Create 1–50 codes, with optional email binding only for a single
code, and expiry presets of 7, 14, or 30 days. The table shows 25 entries per page
and hides pagination when there is only one page. Codes and join links are shown only immediately
after creation and are not saved in browser storage. Copy them before closing.
No email is sent automatically. Writes use the active login session without a
separate recent-sign-in requirement. Status is derived server-side
from redemption, revocation and expiry. The table includes recipient and
redeemer metadata without exposing invite credentials.

The browser sends the API's HttpOnly session cookie with credentials enabled.
`/internal/me` verifies active platform membership in the shared protected layout;
an ordinary customer session is not admin access. No shared admin token is stored
in browser storage. Cross-site deployments must satisfy the API cookie policy;
deploy the portal and API on same-site HTTPS origins.

`PermissionGuard` and `usePermissions` gate controls; route loaders check effective
permissions before fetching team data. Domain hooks own mutation invalidation through
central query keys. Rejected access clears stale query data and rechecks membership.
Team writes require an active authorized session; expired sessions prompt sign-in.
Invitation fragments are held only in tab-scoped session storage through sign-in,
removed from URL history, and cleared on acceptance or cancellation. Use email code
sign-in in the same tab, or reopen the original invitation link after signing in.

Browser telemetry follows the dashboard runtime through server-owned `/t/*` proxy
endpoints under `namera-admin-portal`; optional `VITE_TELEMETRY_SERVICE_VERSION`
identifies the deployed build. No provider credentials enter the browser.

Pending-invitation management, ownership transfer UI, suspension/reactivation UI,
and other operational page contents remain future work. Backend authorization and owner bootstrap are documented in
[platform admin authorization](../../architecture/auth/admin.md).
The prior UI is preserved in `apps/admin-portal-old`, excluded from the workspace.

## Checks and deployment

```sh
pnpm --filter @namera-ai/admin-portal test
pnpm --filter @namera-ai/admin-portal typecheck
pnpm --filter @namera-ai/admin-portal lint
pnpm --filter @namera-ai/admin-portal build
```

The Dockerfile builds static assets and serves them with nginx SPA fallback and
security headers. Set `VITE_API_URL` at build time and the matching exact
`ADMIN_CORS_ORIGIN` on the API. Never deploy the archived portal.
