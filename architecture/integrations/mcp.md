# Local MCP

`namera mcp serve` runs ten SDK-backed tools over stdio. The agent client owns
the process lifecycle. There is no persistent local HTTP API or hosted MCP
endpoint in this implementation.

## Transport and tools

The transport supports Effect's `2026-07-28`, `2025-11-25`, and `2025-06-18`
protocol adapters. Discovery does not require login. Stdin EOF closes the service
and cancels pending authorization. Stdout contains only protocol messages;
diagnostics and consent instructions use stderr.

| Tools                                         | Responsibility                      |
| --------------------------------------------- | ----------------------------------- |
| `list_wallets`, `get_wallet`                  | Grant-scoped account discovery      |
| `list_session_keys`, `get_session_key`        | Session and permission discovery    |
| `simulate_transaction`, `execute_transaction` | Preview or submit a call batch      |
| `get_transaction_status`, `get_executions`    | Submission status and history       |
| `sign`, `verify_signature`                    | Signature creation and verification |

Results use the protocol JSON codec for timestamp and bigint representation.
Text and structured content contain the same value. Error results retain
`isError`, safe codes, and recovery instructions without raw provider causes.

## Authorization lifecycle

MCP has separate credentials from CLI login and API keys. Its default profile is
`default`; origin plus profile identifies the saved grant. Profiles are not OS
security boundaries.

1. The first unauthenticated tool call starts browser consent once per process
   and returns an unauthorized result. The caller retries after consent.
2. Login registers a public native client, generates random state and S256 PKCE,
   and opens the server authorization URL.
3. A temporary listener binds an assigned IPv4 loopback port. It checks exact
   Host/path, state, duplicate parameters, replay, and code-versus-denial shape.
   Origin-bearing callbacks are rejected.
4. The exact registered callback and verifier are used in code exchange.
   Completion, cancellation, or the five-minute deadline closes the listener.
5. The OS keyring stores the schema-validated token bundle. Local files contain
   locking state, not OAuth tokens.

Cross-process SQLite locking serializes profile updates and refresh. Credentials
are reread under the lock; refresh persists the `refreshing` phase before token
rotation. An ambiguous result requires fresh consent. Generation checks prevent
a late login from restoring credentials after logout or replacement.

Logout clears local authority and requests upstream revocation. A failed remote
revocation is reported; imported signing keys remain untouched.

## Per-call authority

Every tool obtains current credentials and reloads the API actor. Effective
scopes intersect token scopes with the live authorization. Read tools require
`mcp:read`; execution and signing additionally require `mcp:execute`.

Before local key access, the selected session must belong to the requested
wallet/namespace and be active in the current grant. The SDK validates the
prepared operation against trusted local bindings, and the API rechecks authority
during completion. Local keys are not an offline bypass for revoked grants.

Tool input cannot supply credentials, key paths, private keys, or a fee ceiling.
The process-level `--max-gas-cost-wei` controls self-funded consent; without it,
only sponsored operations are permitted. Repeating execution can create another
transfer, so callers poll the existing submission.

## Source map

- [Stdio transport](../../apps/cli/src/services/mcp/stdio.ts)
- [Tool schemas and dispatch](../../apps/cli/src/services/mcp/tools.ts)
- [Session lifecycle](../../apps/cli/src/services/mcp/session.ts)
- [Callback validation](../../apps/cli/src/services/mcp/callback.ts)
- [Credential store](../../apps/cli/src/services/mcp/credential-store.ts)
- [Live actor checks](../../apps/cli/src/services/mcp/api-client.ts)
