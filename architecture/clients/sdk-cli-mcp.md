# SDK, CLI, and MCP tools

The SDK, CLI, and MCP server expose the same grant-scoped wallet capabilities
through different client ergonomics. Public contracts originate in `protocol`
and `api`; adapters do not hand-build competing request schemas.

## SDK

`@namera-ai/sdk` wraps the generated Effect HttpApi client in ordinary Promises
returning a discriminated `NameraResult`. It supports `x-api-key`, a fixed bearer
token, or an asynchronous bearer supplier for refreshable interactive clients.

Supported surface:

- `wallets.list` and `wallets.get`;
- `sessionKeys.list({ walletId? })` and `sessionKeys.get`;
- `executions.simulate`, `execute`, `getStatus`, and `list`;
- root `sign` and read-only `verifySignature`.

Declared endpoint errors preserve their exact tagged union in `error.cause`.
Execution and signing generate a UUIDv7 idempotency key internally and reuse it
for three bounded exponential-backoff retries of network, HTTP 408, and HTTP 5xx
failures. Declared business failures are never retried.

## CLI

The CLI uses OAuth device authorization for interactive profiles and the SDK for
operations. Refresh/access tokens live in the operating-system keyring; only
non-secret profile metadata is written atomically to the platform config
directory. Refresh rotation uses a cross-process profile lock. `NAMERA_API_KEY`
supports headless automation.

Commands cover login/logout/status, wallet and session-key reads, execution
simulation/submit/status/history, signing, and verification. Complex operations
accept schema-decoded inline `--params` JSON or use reusable typed interactive
prompts. No request-file input exists.

Global output is `pretty`, `json`, or `ndjson`. Pretty is a colored human view,
not formatted JSON. `--quiet` suppresses normal stdout. Development defaults to
`http://localhost:8080`; `--host` and `NAMERA_API_URL` override it.

## MCP tools

The `/mcp` transport exposes a deliberately compact tool set:

| Tool                                   | Purpose                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| `list_wallets`, `get_wallet`           | Discover exact wallet IDs, addresses, namespaces, and metadata reachable by grants.  |
| `list_session_keys`, `get_session_key` | Discover valid session-key IDs and policies, optionally scoped by wallet.            |
| `simulate_transaction`                 | Preview calls and policy eligibility without signing or persistence.                 |
| `execute_transaction`                  | Submit a policy-approved call batch, sponsored by default with a self-funded option. |
| `get_transaction_status`               | Poll an actor-owned submission.                                                      |
| `get_executions`                       | Read compact confirmed history.                                                      |
| `sign`                                 | Create a policy-approved message or typed-data signature.                            |
| `verify_signature`                     | Verify ERC-1271/ERC-6492 smart-account signatures.                                   |

Descriptions and field annotations distinguish wallet, session key, address,
chain, transaction hash, execution ID, amount, and calldata. Inputs and
structured outputs are root JSON objects compatible with strict MCP clients.
Errors expose stable domain codes and bounded retry metadata through MCP
structured content; defects and arbitrary provider text are not returned.

Read tools require `mcp:read`; execution/signing require `mcp:execute` plus an
active grant and passing policies. The tool adapter generates internal
idempotency keys. `execute_transaction.sponsor` defaults to `true`; setting it
to `false` avoids sponsored-gas usage but does not avoid execution usage.

## Pending

- Define npm/versioning/release/provenance automation for protocol, API, SDK,
  and CLI packages.
- Test packaged CLI profiles and keyrings on macOS, Windows, and Linux and test
  two-process refresh contention against a live server.
- Add convenience SDK polling only after real client usage validates the
  desired behavior.
- Add specialized high-level MCP transaction tools only when they reduce schema
  ambiguity without duplicating the generic execute boundary.
