# @namera-ai/cli

Namera's command-line client and local MCP server. Inspect accounts, import local
session keys, and submit or sign within the permissions approved in your workspace.

## Requirements

Node.js 24.14+ and an accessible OS keyring for saved login credentials and local
signing keys. Create an account and session key in the dashboard, then approve
the networks and permissions it needs.

## Installation

Choose your package manager:

```sh
npm install -g @namera-ai/cli
pnpm add -g @namera-ai/cli
yarn global add @namera-ai/cli
bun add -g @namera-ai/cli
```

`yarn global` requires Yarn Classic. With modern Yarn, use
`yarn dlx @namera-ai/cli --help`. Bun installs the package; the executable runs
on Node.js.

## Quick start

For a local session key, first import the encrypted export from the dashboard:

```sh
namera session-key import <encrypted-export> --host https://api.namera.ai
```

Enter its passphrase at the hidden prompt. Import does not install authority
onchain. Return to the dashboard and approve a network before authorizing the
active key. Managed session keys do not need an import.

Connect the CLI and inspect the accounts available to your grant:

```sh
namera login
namera wallet list
namera session-key list
```

Login opens browser consent and saves credentials in the OS keyring. The default
API is `https://api.namera.ai`. `namera wallet get` and `namera session-key get`
open interactive pickers; pass an ID when running non-interactively.

## Simulate and submit

Interactive commands ask for the account, session key, network, and operation:

```sh
namera execution simulate
namera execution execute
namera sign
```

For scripts, provide every required input. This example simulates a zero-value
call on Base Sepolia; replace the IDs and recipient:

```sh
namera --output json execution simulate --namespace evm \
  --wallet <wallet-id> --session-key <session-key-id> \
  --network 84532 --to <recipient-address> --value 0 --data 0x
```

Transaction values are wei. Networks accept names, numeric IDs, or CAIP-2 IDs.
Use `--params '<json>'` for batch calls using the API request shape; do not mix
it with individual input flags. JSON mode, quiet mode, and redirected input do
not prompt for missing values.

Submission is not confirmation. Check the returned submission instead of sending
the operation again:

```sh
namera execution status <submission-id>
namera execution list
```

For execution, `--sponsor true` requests gas sponsorship. Self-funded execution
requires `--sponsor false --max-gas-cost-wei <ceiling>`. Gas sponsorship does not
fund transferred value. Local and managed sessions use the same commands, but
both need an active grant and installed authority.

## Connect an MCP client

Configure a local stdio client to launch executable `namera` with arguments
`["mcp", "serve", "--profile", "agent"]`. A GUI client may require the absolute
executable path. Authorize that profile separately:

```sh
namera mcp login --profile agent
namera mcp status --profile agent
```

The first unauthenticated tool call can also open browser consent. CLI login and
`NAMERA_API_KEY` do not authorize MCP. Profiles separate saved grants, not OS
users. Cloud-only clients cannot launch this local stdio server.

MCP permits sponsored transactions by default. Set `--max-gas-cost-wei` on
`mcp serve` to permit self-funded transactions up to your ceiling; tools cannot
raise it. Stdout is reserved for MCP messages and diagnostics go to stderr.

## Configuration and output

```sh
namera login --profile dev --host http://localhost:8080
namera wallet list --profile dev
namera --output json session-key list
namera --quiet auth status
```

Ordinary CLI profiles default to `personal`; MCP profiles default to `default`.
For automation, set `NAMERA_API_KEY` and optionally `NAMERA_API_URL`. API-key
authentication takes precedence over the ordinary CLI profile, not MCP profiles.

Human-readable output is the default. `--output json` retains the full response;
`--quiet` suppresses success output. Failures exit nonzero and write to stderr.
JSON failures contain an `error` with `code`, `message`, `nextStep`, and
`retryable`. `NO_COLOR` disables terminal colors.

## Local storage and sign-out

Encrypted key files use a separate unlock secret in the OS keyring. The Node SDK
uses these same files under the same OS user and API origin. There is no plaintext
fallback. Linux needs persistent Secret Service for durable keyring storage;
the keyutils fallback does not survive reboot.

```sh
namera logout
namera mcp logout --profile agent
```

CLI logout removes the local connection. Revoke its authorization in dashboard
settings to end server-side access. MCP logout also requests server revocation.
Neither deletes imported signing keys. An uncertain rotating-token refresh
requires a new login rather than replaying the old token.

## Documentation

- [CLI guides and reference](https://namera.ai/docs/cli)
- [MCP setup](https://namera.ai/docs/mcp)
- [Local key storage](https://github.com/thenamespace/namera/blob/main/architecture/integrations/local-keys.md)

Use matching versions of the CLI, SDK, API, and protocol packages. The CLI ships
its runtime dependencies and needs no separate Effect installation.
