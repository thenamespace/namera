# @namera-ai/api

Public-facing HTTP API definition for Namera, built with Effect `HttpApi`. This
package defines endpoint contracts, groups, middleware requirements, and OpenAPI
metadata. It does not start a server or implement backend workflows.

See [contract package architecture](../../architecture/packages/contracts.md)
for endpoint ownership, schema boundaries, and the contract-to-handler change
sequence.

## Structure

- `src/index.ts` — complete `NameraApi` definition and OpenAPI metadata.
- `src/routes/health.ts` — health endpoint group.
- `src/routes/billing.ts` — read-only active-organization billing and entitlements.
- `src/routes/dashboard.ts` — active-organization operational overview with
  global resource totals and namespace-discriminated operation totals and
  daily, weekly, and monthly activity projections plus execution actor-source
  distribution.
- `src/routes/auth/core/` — core authentication endpoints such as magic links,
  sessions, and users.
- `src/routes/auth/organization/` — organization, membership, and invitation
  endpoints.
- `src/routes/auth/notification.ts` — authenticated inbox and preference endpoints.
- `src/routes/auth/oauth.ts` — authenticated browser/device consent and
  MCP/CLI authorization management endpoints. OAuth wire endpoints remain raw
  server routes.
- `src/routes/wallet.ts` — create, list, get, update organization wallet metadata,
  and list paginated all-chain fungible assets.
- `src/routes/session-key.ts` — register/get/list session keys and prepare/complete
  passkey owner approvals for stored onchain installation/removal operations.
  Member-authorized operation status reads expose no signed envelope or lease.
  Receipt processing is required before activation. Revocation removes API
  grants immediately and finishes after owner-approved onchain removal.
- `src/routes/api-key.ts` — create, get, list, and revoke organization API keys
  with their authorized session keys.
- `src/routes/execution.ts` — read-only execution simulation, API-key execution,
  actor-owned submission status, and member-authorized confirmed execution
  history with expanded account, session-key, and initiating-actor list items.
- `src/routes/ens.ts` — public ENSIP-normalized Namera subname availability.
- `src/routes/signature.ts` — machine-actor message/typed-data preparation and
  local signature completion (`/signatures/prepare`, `/signatures/complete`),
  plus read-only verification. Legacy synchronous signing fails closed.
- `src/middlewares/` — middleware contracts such as authorization context.
- `src/common.ts` — errors shared by API groups.

## Usage

```ts
import { NameraApi } from "@namera-ai/api";
```

`apps/server` supplies handlers, middleware implementations, application
services, runtime layers, and the HTTP server.

## Adding an endpoint

1. Define its request, response, and public error schemas in
   `@namera-ai/protocol`.
2. Add one declarative endpoint to the appropriate `HttpApiGroup`, including
   method, path, payload/query, success status, errors, middleware, and OpenAPI
   annotations.
3. Export the group through its existing barrels and add it to `NameraApi`.
4. Implement the use case in `application` and the adapter in `apps/server`.

Keep route definitions declarative. Do not query repositories, read environment
variables, set cookies, rate-limit, or implement business logic in this package.
Reuse protocol DTOs rather than defining transport shapes inline.
