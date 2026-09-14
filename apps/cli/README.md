# `@namera-ai/cli`

Effect CLI client for Namera. It authorizes a local profile through OAuth 2.1
device authorization, stores refreshable credentials in the operating-system
keyring, and uses `@namera-ai/sdk` for typed wallet operations.

See [SDK, CLI, and MCP tools](../../architecture/clients/sdk-cli-mcp.md) for the
authorization, credential, retry, and command architecture. See
[client workspace architecture](../../architecture/packages/clients.md) for
the CLI/SDK responsibility split.

The stdio MCP transport, persistent OAuth session and callback adapter live in
`services/mcp/`. The agent launches `mcp serve`; credentials remain in the OS
keyring across restarts. Tests cover callback security, refresh/logout races,
stdio discovery and encrypted-keystore signing with substituted API/keyring.
See [local MCP integration status](../../architecture/clients/local-mcp.md).

Run `pnpm --filter @namera-ai/cli typecheck:test` to typecheck both source and
tests, including stdio request authorization.

## Commands

```sh
namera login
namera --output json auth status --profile personal
namera --output ndjson wallet list
namera wallet get <wallet-id>
namera session-key list [--wallet <wallet-id>]
namera session-key get <session-key-id>
namera session-key import <encrypted-export> --profile personal
namera execution simulate
namera execution execute --params '{"namespace":"eip155","walletId":"...","sessionKeyId":"...","chainId":"eip155:1","calls":[...],"sponsor":false}'
namera execution status <submission-id>
namera execution list [--cursor <execution-id>]
namera sign
namera verify-signature --params '{"namespace":"eip155","walletId":"...","chainId":"eip155:1","type":"message","message":"hello","signature":"0x..."}'
namera logout
namera mcp serve --profile codex --host http://localhost:8080
namera mcp login --profile codex
namera mcp status --profile codex
namera mcp logout --profile codex
```

The development build targets `http://localhost:8080` by default, so `namera
login` connects directly to the local API. Pass `--host <origin>` during login
to target another server. For API-key automation, `NAMERA_API_URL` overrides the
same local default.

## Local installation

From the repository root:

```sh
pnpm --filter @namera-ai/cli build
(cd apps/cli && npm link)
namera --help
```

Execution, simulation, signing, and verification prompt for their request fields by default. Pass
the same public request shape inline with `--params '<json>'` for non-interactive use; the CLI
decodes both paths through the public protocol schema and does not read request files.
Interactive execution asks whether Namera should sponsor gas and defaults to yes.
Execution and simulation require the same explicit session key ID; interactive
commands prompt for it separately from the wallet ID.
Inline execution params may set `sponsor` to `false`; omission remains sponsored.
Self-funded execution also requires `--max-gas-cost-wei <amount>` (or the
interactive fee-budget prompt). The local signer rejects preparations above
that budget before signing.

## Local MCP

Register once in your local agent client:

```sh
codex mcp add namera -- namera mcp serve --profile codex
claude mcp add --transport stdio --scope user namera -- namera mcp serve --profile claude
```

Other clients use command `namera` and arguments `["mcp", "serve", "--profile",
"agent"]`. The client launches the process; no manual server or permanent port
is needed. First use opens Namera consent without blocking MCP initialization.
Select installed session keys and retry the tool after consent. If browser opening
fails, run `namera mcp login --profile agent`. Ordinary CLI login and API keys do
not authorize MCP. Import encrypted keys on this machine before signing.

All MCP commands accept `--host` (API origin, default local development) and
`--profile` (default `default`). Use the same flags for login, serve, status and
logout. HTTPS is required except for loopback development. Each origin/profile
stores a separate OAuth bundle in the OS keyring under `namera-mcp`. A private
SQLite lock file contains no credentials and serializes cross-process refresh.
No additional dependency is needed: SQLite is built into the required Node 24.

`--max-gas-cost-wei` sets the user-owned fee ceiling for self-funded operations;
omission permits sponsored operations only. Tools cannot change this ceiling.
Stdout is reserved for MCP; diagnostics and login URLs use stderr. Closing stdin
stops MCP and cancels pending consent. Tokens refresh across restarts; revocation
or ambiguous refresh failure requires fresh login, not repeated token replay.
`mcp status` reports local state. Logout disables that profile and revokes its
server grant without deleting signing keys or other profiles.

## Local session keys

`session-key import` accepts a base64url-encoded encrypted export and prompts
for its passphrase without echoing it. The export must match the active API
origin. Import re-encrypts the key with an independent OS-keyring unlock secret
and atomically installs a non-overwriting encrypted file under `session-keys`
beside the CLI configuration. POSIX directory/file permissions are 0700/0600;
there is no plaintext or keyring-unavailable fallback.

Execution and message/typed-data signing resolve the imported wallet/session/chain
binding locally and use the SDK's validated prepare/sign/complete flows. `sign`
requires an explicit session key ID and locally exported signature consent;
older exports without `allowSignatures: true` cannot sign messages. Browser
export and local MCP use this same binding. Normal storage tests use a
substitute keyring. Opt in to the real platform-keyring test with
`NAMERA_TEST_OS_KEYRING=1 pnpm --filter @namera-ai/cli test tests/e2e/os-keyring.test.ts`.
It uses an isolated credential namespace and temporary files and cleans both up.
Import and reopening passed on macOS; Windows/Linux remain unverified.
The built CLI prompt has separate coverage below.

For the built command's hidden-passphrase prompt and real macOS keyring import,
build first, then run the opt-in terminal test (requires `python3` for its
standard-library pseudo-terminal):

```sh
pnpm --filter @namera-ai/cli build
NAMERA_TEST_OS_KEYRING=1 pnpm --filter @namera-ai/cli test tests/e2e/packaged-import.test.ts
```

This test uses an isolated config directory and an unused random API credential;
import is local and makes no API call. It does not test login, OAuth or onchain
signing. Temporary files and keyring entries are removed afterward.

`--output pretty|json|ndjson` is global and defaults to `pretty`. Pretty output is an indented,
colorized terminal view with readable labels and values; it is not JSON. JSON emits one compact
document, while NDJSON emits one compact document per top-level array item. `--quiet` (or `-q`)
suppresses normal command output. Execution and signing commands rely on the SDK to generate one
idempotency key and reuse it across transient retries; no retry-key flag is exposed.

## Credentials

Profile metadata is stored in the platform configuration directory. Access and
refresh tokens are stored only through `@napi-rs/keyring`. The CLI does not
silently fall back to plaintext credentials. `NAMERA_API_KEY` is supported for
headless automation and takes precedence over profile credentials.

Refresh-token rotation is guarded by a cross-process profile lock. Commands
re-read the keyring after acquiring that lock before deciding whether a refresh
is necessary.
