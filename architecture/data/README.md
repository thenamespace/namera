# Data model

PostgreSQL holds authority, resources, operation state, reservations, and durable
jobs. Drizzle schemas are the executable definition; the tables below link to
domain references with purpose, keys, and important constraints.

| Domain                                                                    | Reference                                  |
| ------------------------------------------------------------------------- | ------------------------------------------ |
| Users, sessions, workspace and platform membership, delegated credentials | [Identity and access](identity-access.md)  |
| Accounts, session keys, transactions, signatures, reconciliation          | [Wallets and operations](wallets.md)       |
| Subscription periods, meters, reservations, settlement                    | [Billing](billing.md)                      |
| Notifications, delivery preferences, email jobs, feedback                 | [Notifications and jobs](notifications.md) |
| Tokens, contracts, deployments, interfaces                                | [Catalog](catalog.md)                      |
| Typed historical events                                                   | [Audit](audit.md)                          |

## Persistence boundary

Repository methods use the normal database or the active transaction context.
Application workflows own multi-repository transactions. Related state, audit
events, and email jobs commit together. Provider calls do not participate in SQL
rollback.

Constraints, unique keys, and locked checks enforce tenant identity, idempotency,
and finite-resource admission. Public DTOs are separate from stored records:
credential hashes, encrypted payloads, and private provider material are not
ordinary response fields.

The migration history is append-only. Current schemas and their relations live
in [packages/database/src/schema](../../packages/database/src/schema);
queries live in [repositories](../../packages/database/src/repositories).
See the [database package](../../packages/database/README.md) for commands.
