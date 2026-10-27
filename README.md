# Namera

**Wallets for AI agents with permissions built in.**

Give agents the power to transact. You set what they can spend and do.

Namera combines smart accounts, scoped session keys, and delegated access through
an SDK, CLI, or MCP. Manage accounts and permissions in the dashboard, then let
agents operate within the access you grant.

[Website](https://namera.ai) · [Documentation](https://namera.ai/docs) ·
[Dashboard](https://dashboard.namera.ai)

## What it does

- Creates EVM smart accounts with user-owned passkeys or managed custody.
- Grants session keys per-network permissions, spending limits, and expiry.
- Exposes delegated transactions and signatures through API-key or OAuth access.
- Tracks submission and confirmation separately, with durable reconciliation.
- Provides workspace membership, billing allowances, notifications, and ENS identities.

Onchain permissions and server-side policies enforce different boundaries.
See the [system model](architecture/system.md) before extending execution or signing.

## Repository

TypeScript monorepo using Node.js 24, pnpm, Turborepo, and Effect v4.

| Workspace                                           | Purpose                                               |
| --------------------------------------------------- | ----------------------------------------------------- |
| [Server](apps/server)                               | HTTP API, authorization, runtime composition, workers |
| [Dashboard](apps/dashboard)                         | Account and workspace management                      |
| [Admin portal](apps/admin-portal)                   | Platform operations                                   |
| [Website](apps/web)                                 | Marketing, documentation, blog                        |
| [CLI](apps/cli)                                     | Terminal client and local MCP server                  |
| [SDK](packages/sdk)                                 | Typed application client                              |
| [Application](packages/application)                 | Business workflows                                    |
| [Database](packages/database)                       | PostgreSQL schemas and repositories                   |
| [EVM](packages/evm)                                 | Accounts, execution, signing, policies                |
| [Protocol](packages/protocol) / [API](packages/api) | Runtime schemas and HTTP contracts                    |
| [UI](packages/ui)                                   | Shared React components and theme                     |

Provider adapters, ENS, crypto, email delivery, telemetry, templates, and utilities
live in their own packages. Start with the [architecture knowledge base](architecture/README.md)
for their boundaries.

## Local development

Use the versions pinned in [.node-version](.node-version) and [package.json](package.json).
Copy the server and dashboard `.env.example` files to local `.env` files and
configure the required services.

```sh
pnpm install
pnpm dev:services:up
pnpm --filter @namera-ai/server dev
```

In another terminal:

```sh
pnpm --filter @namera-ai/dashboard dev
```

The API uses port 8080 and the dashboard uses port 3000. See
[development](architecture/engineering/development.md) for other apps and
[server configuration](apps/server/README.md) for provider requirements.

## Checks

```sh
pnpm check
pnpm test
pnpm pack:check
```

These commands check source, run tests, and validate public packages.
They do not deploy or publish. See [testing](architecture/engineering/testing.md)
and [delivery](architecture/runtime/delivery.md).

## Contributing and security

Follow [AGENTS.md](AGENTS.md) for repository conventions. Keep architecture docs
aligned with implemented behavior and package READMEs aligned with their exports.

Report vulnerabilities privately using the [security policy](SECURITY.md).

## License

Copyright 2026 Namespace Inc. Licensed under the [Apache License 2.0](LICENSE).
