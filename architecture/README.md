# Architecture

Technical knowledge base for Namera's current implementation. Start with the
[system model](system.md), then follow the boundary relevant to your work.
Executable contracts, schemas, and source remain authoritative.

## Identity and access

- [Authentication](identity-access/authentication.md): browser sessions, sign-in, admission.
- [Organizations](identity-access/organizations.md): membership, roles, invitations.
- [Delegated access](identity-access/delegated-access.md): API keys, OAuth, grants.
- [Platform administration](identity-access/administration.md): operator authority.

## Wallet system

- [Accounts](wallet-system/accounts.md): smart accounts and custody providers.
- [Session keys](wallet-system/session-keys.md): creation, installation, grants, revocation.
- [Transactions](wallet-system/transactions.md): owner and delegated preparation/submission.
- [Signatures](wallet-system/signatures.md): message/typed-data authorization and verification.
- [Reconciliation](wallet-system/reconciliation.md): attempts, receipts, retries, terminal states.
- [Policies](wallet-system/policies.md): onchain permissions and server enforcement.
- [Identity](wallet-system/identity.md): ENS names, records, and profile images.
- [Portfolio](wallet-system/portfolio.md): balances, pricing, caching.

## Services and persistence

- [Billing](services/billing.md): allowances, reservations, settlement.
- [Notifications and email](services/notifications.md): recipients, preferences, durable delivery.
- [Feedback](services/feedback.md): customer submission and operator review.
- [Data model](data/README.md): table references, keys, constraints, and ownership.

## Integrations and interfaces

- [Contracts](integrations/contracts.md): protocol schemas and HTTP API.
- [SDK](integrations/sdk.md), [CLI](integrations/cli.md), and [MCP](integrations/mcp.md).
- [Local keys](integrations/local-keys.md): encrypted export/import and signing boundary.
- [Dashboard](interfaces/dashboard.md), [admin portal](interfaces/admin-portal.md),
  and [website](interfaces/website.md).

## Runtime and engineering

- [Server](runtime/server.md): composition, request lifecycle, workers.
- [Observability](runtime/observability.md): traces, metrics, logs, analytics.
- [Delivery](runtime/delivery.md): application deployment and npm releases.
- [Development](engineering/development.md): workspace boundaries and local commands.
- [Testing](engineering/testing.md): fixtures, integration lanes, verification.

## Keeping this useful

Describe what the code does now: ownership, contracts, state transitions,
transaction boundaries, and limitations that affect callers. Keep historical
changes, audit checklists, and speculative plans out of these pages.

One page owns each topic. Link to related flows and source rather than repeating
their implementation. Database references retain important constraints without
duplicating every schema declaration. Package READMEs explain local usage; public
package READMEs are written for consumers, not repository contributors.
