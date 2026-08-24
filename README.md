# Namera

Namera is a programmable-wallet platform for agents and applications. Users
create organization-owned smart accounts, define immutable session-key policies,
and delegate those keys to API keys, MCP clients, or the Namera CLI. Namera
simulates every EVM operation, enforces the complete delegated policy set, and
signs only through provider-managed wallet keys.

The repository is a pnpm/Turborepo TypeScript monorepo targeting Node.js 24 and
Effect v4.

## Architecture

Start with the [architecture index](architecture/README.md). It contains the
implemented system model, feature flows, table constraints, transaction
boundaries, security invariants, and feature-specific production work.

Useful entry points:

- [Repository and package boundaries](architecture/engineering/repository.md)
- [Workspace ownership and extension guides](architecture/packages/README.md)
- [Canonical database catalog](architecture/database/README.md)
- [Feature development](architecture/engineering/development.md)
- [Authentication and authorization](architecture/auth/README.md)
- [Accounts and session keys](architecture/wallets/accounts.md)
- [EVM namespace, chains, accounts, execution, signatures, and policies](architecture/evm/README.md)
- [Executions](architecture/operations/executions.md)
- [Billing and entitlements](architecture/billing/README.md)
- [Production readiness](architecture/platform/production.md)

Package READMEs document the local structure and development rules of each
workspace. Repository-wide agent rules are in [AGENTS.md](AGENTS.md).

## Workspaces

| Workspace              | Responsibility                                                                  |
| ---------------------- | ------------------------------------------------------------------------------- |
| `apps/server`          | HTTP/MCP runtime, authorization, route handlers, workers, and live composition. |
| `apps/dashboard`       | React dashboard and authorization consent UI.                                   |
| `apps/cli`             | OAuth device client and delegated wallet commands.                              |
| `apps/email-templates` | Runtime-template preview and email asset generation.                            |
| `packages/protocol`    | Effect Schemas, models, DTOs, identities, and expected errors.                  |
| `packages/database`    | Drizzle schemas, migrations, transactions, and repositories.                    |
| `packages/application` | Business workflows and transaction orchestration.                               |
| `packages/api`         | Public Effect HttpApi contract.                                                 |
| `packages/evm`         | Chains, smart accounts, execution, signing, verification, and policies.         |
| `packages/wallet-keys` | Local and Google Cloud KMS key lifecycle.                                       |
| `packages/ens`         | Namespace-backed offchain ENS subname and record management.                    |
| `packages/emails`      | Encrypted durable email outbox and React Email delivery.                        |
| `packages/crypto`      | Purpose-separated hashing, HMAC, encryption, and credentials.                   |
| `packages/telemetry`   | OTLP exporters and shared bounded metrics.                                      |
| `packages/sdk`         | Promise client for API-key and OAuth-bearer consumers.                          |
| `packages/ui`          | Shared source-only React UI.                                                    |
| `packages/utils`       | Dependency-light shared helpers.                                                |

## Local development

Install dependencies and start the required local services:

```sh
pnpm install
docker compose up -d
pnpm dev
```

The server defaults to `http://localhost:8080`, the dashboard to
`http://localhost:3000`, the API reference to `http://localhost:8080/reference`,
and the React Email preview to `http://localhost:4000` when started separately.

## Verification

```sh
pnpm check
pnpm test
pnpm build
```

Use package filters for focused work, for example:

```sh
pnpm --filter @namera-ai/server test
pnpm --filter @namera-ai/dashboard typecheck
pnpm --filter @namera-ai/cli build
```
