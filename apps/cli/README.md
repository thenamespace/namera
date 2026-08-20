# `@namera-ai/cli`

Effect CLI client for Namera. It authorizes a local profile through OAuth 2.1
device authorization, stores refreshable credentials in the operating-system
keyring, and uses `@namera-ai/sdk` for typed wallet operations.

See [SDK, CLI, and MCP tools](../../architecture/clients/sdk-cli-mcp.md) for the
authorization, credential, retry, and command architecture. See
[client workspace architecture](../../architecture/packages/clients.md) for
the CLI/SDK responsibility split.

## Commands

```sh
namera login
namera --output json auth status --profile personal
namera --output ndjson wallet list
namera wallet get <wallet-id>
namera session-key list [--wallet <wallet-id>]
namera session-key get <session-key-id>
namera execution simulate
namera execution execute --params '{"namespace":"eip155","walletId":"...","chainId":"eip155:1","calls":[...]}'
namera execution status <submission-id>
namera execution list [--cursor <execution-id>]
namera sign
namera verify-signature --params '{"namespace":"eip155","walletId":"...","chainId":"eip155:1","type":"message","message":"hello","signature":"0x..."}'
namera logout
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
