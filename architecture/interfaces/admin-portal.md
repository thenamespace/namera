# Admin portal

The portal is a static React SPA. It calls the server's typed `/internal` API
using a verified user session and active platform membership. Workspace ownership
alone does not grant platform access. No database or provider credential is shipped
to the browser.

## Access and data

The protected layout refreshes the current admin actor before rendering. Route
loaders check effective permissions before fetching protected resources; control
visibility uses the same permission model. These checks are presentation guards,
not a substitute for server authorization.

Effect atoms own requests and query keys. Hooks own mutation invalidation. The
client includes cookies at request time; logout leaves the protected application
through a document navigation. Rejected access triggers membership revalidation.

## Surfaces

| Surface      | Operations                                                       |
| ------------ | ---------------------------------------------------------------- |
| Overview     | Lifetime counts and period growth/activity                       |
| Team         | Membership and invitations; owner-controlled management          |
| Beta invites | Create, inspect, and revoke admission codes                      |
| Waitlist     | Review requests and accept through emailed invites               |
| Feedback     | Read messages and manage their status                            |
| Catalog      | Inspect token/contract deployments; validate and confirm imports |
| Interfaces   | Inspect contract interface metadata and ABI documents            |

Catalog imports are validated before explicit confirmation. Input files stay in
memory, and server-side validation/authorization runs again. Invite codes are
shown at creation rather than recovered from stored plaintext. Team invitation
secrets are removed from URL history and held in tab-scoped storage while signing in.

## Deployment

The API origin is build-time public configuration. The server must allow the
exact portal origin through `ADMIN_CORS_ORIGIN`; cookie deployment must also
satisfy the server's HTTPS/same-site policy. Google authentication returns through
the server callback. Nginx serves the SPA with generated document security headers.

See [platform administration](../identity-access/administration.md) for server
permissions, bootstrap, and state transitions.

## Source

- [Protected layout](../../apps/admin-portal/src/routes/_authenticated/route.tsx)
- [Client and atoms](../../apps/admin-portal/src/atoms)
- [Routes](../../apps/admin-portal/src/routes)
- [Runtime image](../../apps/admin-portal/Dockerfile)
