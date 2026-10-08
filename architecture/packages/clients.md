# Client workspaces: SDK, CLI, and MCP

## `packages/sdk`

The publishable SDK is the typed Promise client over the public API, with API-key
and OAuth bearer authentication. Its default origin is `https://api.namera.ai`.
Domain methods preserve declared protocol errors and caller cancellation.
Execution and signature preparation generate retry-stable idempotency keys;
bounded retries cover transient transport outcomes, not business denials.

Execution and signing use prepare/local-sign/complete. The client checks the
server payload against locally trusted installation bindings before invoking a
signer. Local private keys never enter HTTP requests. Completion retries reuse
the same signature, and accepted operations are polled by submission ID.

## `apps/cli`

Effect CLI commands use the SDK. Device OAuth supports interactive profiles;
`NAMERA_API_KEY` supports headless access. Refresh credentials use the OS keyring
and rotation is serialized across processes. Local session keys use encrypted
files with independent keyring-held unlock secrets.

Commands accept schema-decoded `--params` or individual flags and prompts.
`pretty` presents human-readable summaries; `json` emits the DTO. Quiet mode
suppresses guidance, and noninteractive commands never prompt for missing input.

## Local MCP

`namera mcp serve` exposes ten SDK-backed tools over stdio in the CLI process.
The parent agent starts and stops it. Tool calls use separate browser OAuth
consent, persisted keyring credentials and live server grants. The temporary
loopback listener exists only during the OAuth callback, not as an MCP endpoint.
Signing uses the same imported local keystore and SDK validation as CLI commands.
Stdout is reserved for protocol messages; diagnostics use stderr.

The API owns OAuth issuance, revocation and authorization management. It does
not host MCP transport. Tool schemas distinguish wallet and session-key IDs,
CAIP-2 chains and operation status; callers poll uncertain submissions instead
of creating a second transfer.

## Release and detailed contracts

The API, protocol, SDK and CLI are released as a fixed Changesets group. The
manual release workflow builds and publishes their packages. `pnpm pack:check`
validates candidate tarballs and consumer entry points before release.

- [SDK and CLI operations](../clients/sdk-cli-mcp.md)
- [MCP authorization and transport](../clients/local-mcp.md)
- [Local encrypted key storage](../clients/local-keystore.md)
- [Packaging and test lanes](../engineering/testing.md)
