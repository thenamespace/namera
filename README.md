# Namera

Namera is a programmable-wallet platform for agents and applications. Users
create organization-owned smart accounts, define immutable session-key policies,
and delegate access to API keys, MCP clients, or the Namera CLI. Account owners
use passkeys; agents sign with locally stored session keys. The server prepares
and validates operations but does not hold users' private signing keys. Onchain
permissions and Namera-enforced policies have different enforcement boundaries.

The repository is a pnpm/Turborepo TypeScript monorepo targeting Node.js 24 and
Effect v4.

## License and security

Copyright 2026 Namespace Inc.

Namera source code is licensed under [Apache License 2.0](LICENSE). See the
[security policy](SECURITY.md) to report vulnerabilities privately and review
supported versions.

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

Public package READMEs contain installation and usage examples. Private package
READMEs document development. Repository-wide rules are in [AGENTS.md](AGENTS.md).

## Workspaces

| Workspace                     | Responsibility                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------- |
| `apps/server`                 | HTTP runtime, authorization, route handlers, workers, and live composition.     |
| `apps/dashboard`              | React dashboard and authorization consent UI.                                   |
| `apps/cli`                    | OAuth client, local stdio MCP server, and delegated wallet commands.            |
| `apps/web`                    | Public website, pricing, and waitlist form.                                     |
| `apps/email-templates`        | Runtime-template preview and email asset generation.                            |
| `packages/protocol`           | Effect Schemas, models, DTOs, identities, and expected errors.                  |
| `packages/database`           | Drizzle schemas, migrations, transactions, and repositories.                    |
| `packages/application`        | Business workflows and transaction orchestration.                               |
| `packages/api`                | Public Effect HttpApi contract.                                                 |
| `packages/evm`                | Chains, smart accounts, execution, signing, verification, and policies.         |
| `packages/wallet-providers/*` | Independent GCP/local services; managed signing disabled in the server runtime. |
| `packages/ens`                | Namespace-backed offchain ENS subname and record management.                    |
| `packages/emails`             | Encrypted durable email outbox and React Email delivery.                        |
| `packages/crypto`             | Purpose-separated hashing, HMAC, encryption, and credentials.                   |
| `packages/telemetry`          | OTLP exporters and shared bounded metrics.                                      |
| `packages/sdk`                | Promise client for API-key and OAuth-bearer consumers.                          |
| `packages/ui`                 | Shared source-only React UI.                                                    |
| `packages/utils`              | Dependency-light shared helpers.                                                |

## Local development

Use the Node version in `.node-version` and pnpm version in `package.json`.
Copy the server and dashboard `.env.example` files to `.env` in their respective
directories and configure them before starting:

```sh
pnpm install
docker compose up -d
pnpm --filter @namera-ai/server dev
# Separate terminal:
pnpm --filter @namera-ai/dashboard dev
```

The server defaults to `http://localhost:8080`, the dashboard to
`http://localhost:3000`, the API reference to `http://localhost:8080/reference`,
and the website to `http://localhost:4000` when started separately with
`pnpm --filter @namera-ai/web dev`. The email preview also uses port 4000, so run
it separately. See [website configuration](apps/web/README.md) to enable waitlist CORS.

## Public packages and releases

- [SDK](packages/sdk/README.md): promise-based application client.
- [CLI](apps/cli/README.md): terminal commands and Codex/Claude MCP setup.
- [API](packages/api/README.md): Effect HttpApi contract and OpenAPI generation.
- [Protocol](packages/protocol/README.md): runtime schemas and types.

Clients default to `https://api.namera.ai`; use explicit local overrides in
development. These four packages form one fixed Changesets release group. The
pending major changeset aligns them at 1.0.0. See [release instructions](.changeset/README.md)
for the manual GitHub release-PR and npm publication workflow.

## Server deployment

`apps/server/Dockerfile` builds only the server runtime, with the repository root as its build context. Use
[`apps/server/.env.prod.example`](apps/server/.env.prod.example) for production
configuration and [server instructions](apps/server/README.md) to build/run it.
Review the maintained [deployment gates](architecture/platform/production.md);
passing CI is not a substitute for provider, backup, or ingress verification.

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
