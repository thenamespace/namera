# Backend workspaces: database, application, and server

## `packages/database`

Database owns PostgreSQL representation and reusable queries. Drizzle schema modules mirror PostgreSQL schemas by domain. Repositories expose focused operations that work with the normal client and `TransactionService.run` through the transaction context.

### Repository rules

- Accept tenant/actor/resource IDs explicitly; do not rely on ambient organization state.
- Use composite tenant foreign keys and conditional updates for security lifecycles.
- Return `undefined`/typed result for expected not-found/conflict; map SQL defects to `DatabaseError`.
- Keep joins/projections aligned to actual list/detail needs; do not make every list load full actor detail.
- Use `FOR UPDATE` only at explicit serialization boundaries and acquire locks deterministically.
- Do not pass raw transaction clients through application APIs.

### Adding persistence

1. Add protocol model/IDs first.
2. Add table, all nullability/defaults, constraints, tenant FKs, and query-driven indexes.
3. Add relations and focused repository operations.
4. Add migration and database integration tests.
5. Update `architecture/database` in the same commit.

## `packages/application`

Application owns business workflows. Aggregate services compose repositories, chain adapters, crypto, wallet keys, billing, audit, notifications, and transactions. They accept actor/organization context resolved by server middleware but never import HTTP constructs.

### Workflow shape

1. Load/validate domain state and perform cheap prechecks.
2. Make required remote calls outside transactions.
3. Begin the smallest transaction that protects the state transition.
4. Lock/recheck capacity and security invariants.
5. Mutate domain rows and required audit/notification/outbox rows atomically.
6. Emit bounded metrics/logs after a real transition.
7. Map only expected domain failures; unexpected defects remain defects.

Use `Effect.fn("application.domain.operation")`, `Effect.gen`, and aggregate services. Place shared workflow helpers in their domain directory, not as unrelated top-of-file utilities.

### Namespace dispatch

Application validates common actor/grant/billing/persistence concerns and dispatches namespace-specific account/execution/signature/policy behavior to adapters. Adding Solana should add a Solana adapter and union branch, not large EVM/Solana conditionals throughout unrelated workflows.

## `apps/server`

Server is the Node composition and transport boundary:

- read Effect `Config` and keep secrets `Redacted`;
- provide Node crypto, PostgreSQL, providers, telemetry, and application layers;
- implement typed API handlers;
- resolve cookie/API-key/OAuth actors and permissions;
- apply cookies, form parsing, redirects, headers, rate limits, and request context;
- retain MCP OAuth while the CLI hosts local Streamable HTTP and tool adapters;
- start/stop workers with runtime lifecycle.

Handlers should decode through `HttpApi`, enforce transport/actor policy, call one application operation, and map the safe result. They should not duplicate queries or business transactions.

The outer `SecurityHeadersMiddleware` installs API-origin response protections
before rate limiting and routing. Its pre-response handler adds
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and
`Referrer-Policy: no-referrer` without replacing existing cache, redirect, or
cookie headers. Focused transport tests cover success, redirect, and error
response statuses. Dashboard document CSP and WebAuthn Permissions-Policy must
be configured on the dashboard origin; these API headers do not supply them.

`RequestBodyLimitMiddleware` bounds decoded request bodies to 2 MiB, with a
64 KiB limit for `/oauth/*`. Declared oversized bodies return 413/no-store;
the Node text/JSON/form/binary readers enforce the same limit as chunks arrive,
so omitting Content-Length does not bypass it. Overflow during reading may
produce a decode error or close the connection before a response can be sent.
These are transport bounds, not policy-entry or call-count limits. New streaming
routes must explicitly bound `request.stream`, which bypasses buffered readers.
The Node server sets 10-second header, 30-second request-receive, 5-second
keep-alive timeouts and a 16 KiB header limit. Provider timeouts are independent.
Real-socket tests cover declared and chunked overflow, subsequent valid requests,
and listener cleanup; they do not simulate slow-header timeout expiry.

## Testing path

- Repository tests prove constraints/query/transaction behavior.
- Application tests use package-owned test layers for remote services.
- Server boundary tests compose real application/database layers and substitute provider adapters, rather than mocking application internals.
- Authorization tests prove each credential/permission/grant combination.

## Pending before production

- Add deployment migration/worker ordering runbooks.
- Complete server boundary permission matrix.
- Add fault-injection tests at remote-call/transaction/reconciliation boundaries.
