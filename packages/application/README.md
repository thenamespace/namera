# @namera-ai/application

Backend workflows for authentication, organizations, wallets, session keys,
execution, signing, billing, notifications and administration. This private
package coordinates repositories and providers behind the `Application` service.

## Boundaries

HTTP handlers own transport authorization, cookies, Origin checks and response
mapping. Application workflows own business invariants and repeat authority checks
under locks when concurrent revocation matters. Repositories own queries;
chain adapters own encoding and verification; custody packages own provider access.

Related state changes, audit events, notification recipients and email jobs share
`TransactionService.run`. Remote work runs outside long database transactions.
Managed provisioning records intent before remote mutation and repeats locked
resource admission before committing the result.

## Layout

- `src/auth/` — identity, organizations, delegation and platform membership.
- `src/wallet/`, `src/session-key/`, `src/execution/`, `src/signature/` — wallet workflows.
- `src/provisioning/`, `src/oneclaw/` — durable provisioning and provider coordination.
- `src/billing/` — allowance admission, settlement, periods and recovery.
- `src/notification/`, `src/audit/` — transactional delivery, analytics milestones and history.
- `src/catalog/`, `src/data/`, `src/dashboard/`, `src/feedback/`, `src/ens/` — product services.
- `src/application.ts` — aggregate composition.

## Configuration

| Variable                                   | Purpose                                       |
| ------------------------------------------ | --------------------------------------------- |
| `AUTH_API_PUBLIC_ORIGIN`                   | Required API origin and OAuth audience.       |
| `AUTH_DASHBOARD_PUBLIC_ORIGIN`             | Required dashboard origin and links.          |
| `ADMIN_CORS_ORIGIN`                        | Optional admin origin and invitation links.   |
| `AUTH_INVITE_REQUIRED`                     | Beta admission; defaults to `true`.           |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Configure together for Google authentication. |

TTL and credential policies live in `src/auth/data.ts`; allowances live in
`src/billing/data.ts`. The server supplies infrastructure layers and secrets.

## Development

```sh
pnpm --filter @namera-ai/application typecheck
pnpm --filter @namera-ai/application test
pnpm --filter @namera-ai/application build
```

Cross-package workflows are exercised through server integration tests with real
repositories and package-owned provider substitutes. See the
[architecture index](../../architecture/README.md),
[billing](../../architecture/services/billing.md), and
[runtime](../../architecture/runtime/server.md).
