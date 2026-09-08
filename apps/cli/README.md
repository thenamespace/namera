# `@namera-ai/cli`

Effect CLI client for Namera. It authorizes a local profile through OAuth 2.1
device authorization, stores refreshable credentials in the operating-system
keyring, and uses `@namera-ai/sdk` for typed wallet operations.

See [SDK, CLI, and MCP tools](../../architecture/clients/sdk-cli-mcp.md) for the
authorization, credential, retry, and command architecture. See
[client workspace architecture](../../architecture/packages/clients.md) for
the CLI/SDK responsibility split.

The local MCP OAuth broker and upstream adapter live in `services/mcp/`.
They keep local and API credentials separate and test replay, expiry and refresh
revocation races. OAuth routes, transport guards, SDK-backed tools, and live
authorization/session isolation are tested through the in-memory HTTP boundary.
`mcp start` runs the loopback HTTP listener. The integrated HTTP test covers local
OAuth, encrypted key import/unlock, the CLI signer resolver and SDK signature
completion with substituted upstream services and keyring. A live Sepolia journey
also verified browser export, packaged CLI import with the macOS keyring, OAuth,
execution, typed-data signing and onchain removal. Secure broker persistence
remains deferred; restarting requires reauthorization. See
[local MCP integration status](../../architecture/clients/local-mcp.md).

Run `pnpm --filter @namera-ai/cli typecheck:test` to typecheck both source and
tests, including HTTP request-context composition.

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
namera mcp start --host http://localhost:8080 --port 3847
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

Run `namera mcp start`, then connect your agent to `http://127.0.0.1:3847/mcp`.
The agent completes OAuth through Namera's consent page; ordinary CLI login or
`NAMERA_API_KEY` does not grant MCP access. Select only the sessions that agent
should use, and import their encrypted keys on this machine before signing.

`--host` selects the API origin, not the bind address. HTTPS is required except
for local development. The listener always binds `127.0.0.1`; it cannot be exposed
on a public interface through flags. `--port` changes all local discovery and
callback URLs consistently. `--max-gas-cost-wei` sets a user-owned per-operation
fee ceiling for self-funded transactions; without it, those transactions fail
local validation. Agents cannot override this ceiling through tool arguments.

Keep the process running. OAuth broker state is currently in memory and restarting
requires reauthorization; local signing keys remain in the encrypted keystore.
Ctrl-C closes the listener. JSON/NDJSON print one readiness object after binding;
`--quiet` suppresses it. Request URL logging is disabled to avoid logging OAuth
callback credentials.

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
