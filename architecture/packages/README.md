# Workspace ownership map

This section explains how to work across every app and package. Package READMEs provide local commands/exports; these pages explain architectural responsibility and change paths.

## Guides

- [Contracts: protocol and API](contracts.md)
- [Backend: database, application, and server](backend.md)
- [Chain and custody: EVM, wallet keys, and crypto](chain-custody.md)
- [Delivery: emails, telemetry, UI, and dashboard](delivery.md)
- [Clients: SDK, CLI, and MCP](clients.md)
- [Utilities, ENS, passkeys, and templates](supporting.md)

## Workspace index

| Workspace                     | Kind    | Owns                                                              | Must not own                                          |
| ----------------------------- | ------- | ----------------------------------------------------------------- | ----------------------------------------------------- |
| `apps/server`                 | App     | Node runtime, handlers, middleware, live layers, workers          | Reusable business rules or public schemas             |
| `apps/dashboard`              | App     | Browser routes, atoms/hooks, authenticated product UI             | Backend authorization decisions or secrets            |
| `apps/web`                    | App     | Public landing/waitlist, documentation and blog                   | Backend workflows or authenticated product UI         |
| `apps/admin-portal`           | App     | Platform-member UI over authenticated internal APIs               | Database access or separate backend authorization     |
| `apps/cli`                    | App     | CLI, device OAuth, local keystore and stdio MCP                   | Duplicate HTTP/domain implementation                  |
| `apps/email-templates`        | App     | Template preview and email-safe asset generation                  | Runtime delivery                                      |
| `packages/protocol`           | Package | Schemas, IDs, models, DTOs, typed errors                          | Infrastructure or Effect services                     |
| `packages/api`                | Package | Typed public `HttpApi` contract                                   | Handlers or business logic                            |
| `packages/application`        | Package | Use cases, transactions, billing/audit/notification orchestration | HTTP/cookies or provider composition                  |
| `packages/database`           | Package | Drizzle schema, PostgreSQL layer, repositories                    | Business workflow or public DTO mapping               |
| `packages/crypto`             | Package | Purpose-separated crypto primitives/service                       | Domain workflows                                      |
| `packages/wallet-providers/*` | Package | Independent provider-specific services, schemas and tests         | Chain-specific account logic or application workflows |
| `packages/passkeys`           | Package | WebAuthn ceremonies and cryptographic verification                | Application challenge persistence or wallet workflows |
| `packages/ens`                | Package | Offchain ENS subname and record provider boundary                 | Account workflow orchestration                        |
| `packages/evm`                | Package | EVM chains/accounts/execution/signatures/policies                 | Organization/billing/HTTP concerns                    |
| `packages/emails`             | Package | Typed encrypted outbox, templates, worker, provider               | Product transaction decisions                         |
| `packages/telemetry`          | Package | OTLP layers and metric definitions                                | Audit history or arbitrary cardinality                |
| `packages/ui`                 | Package | Shared React/UIKit components and presentation helpers            | Route/business data orchestration                     |
| `packages/sdk`                | Package | Publishable typed API/OAuth client                                | CLI prompts or MCP tools                              |
| `packages/utils`              | Package | State-free low-level helpers                                      | Effect services or product workflows                  |
| `packages/template`           | Package | New-workspace starter                                             | Product runtime behavior                              |

## Cross-package change order

For a public persisted feature, change in this order:

```text
protocol → database → application → api → server → sdk/cli/mcp/dashboard
```

Chain-specific code enters through the adapter before application:

```text
protocol → evm/new-namespace package → application dispatch → api/server/clients
```

Email and telemetry are side branches selected by application/runtime, never substitutes for the core domain record.
