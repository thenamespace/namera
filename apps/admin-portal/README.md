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
- `/invites`: Beta invites.
- `/team`: Admin team.
- `/activity`: Admin activity.

All five protected pages are empty scaffolds with a shared UIKit inset sidebar,
active navigation, tooltips, and a responsive off-canvas menu. The page header
toggles the sidebar; UIKit also provides the `Cmd/Ctrl+B` shortcut. Navigation,
Inter typography, icons, and compact spacing follow the dashboard. These pages
do not fetch operational data or expose management actions yet.

The browser sends the API's HttpOnly session cookie with credentials enabled.
`/internal/me` verifies active platform membership in the shared protected layout;
an ordinary customer session is not admin access. No shared admin token is stored
in browser storage. Cross-site deployments must satisfy the API cookie policy;
deploy the portal and API on same-site HTTPS origins.

Team invitation acceptance, role-specific controls, and operational page contents
are not implemented yet. Backend authorization and owner bootstrap are documented in
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
