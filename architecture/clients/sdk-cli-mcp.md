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

Paused networks return the declared `NETWORK_PAUSED` business code, not a
transport failure. SDK/CLI messages identify the pause, and MCP returns the same
code with `retryable: false`; callers should wait for re-enablement. Already
accepted submissions retain their status/recovery flow.

Execution and simulation requests select `sessionKeyId` explicitly alongside
the wallet and chain. Simulation uses that installed session's public-only
account adapter and API policies; it never previews a different signer. The
legacy server execution call fails closed. The SDK uses the detached flow below.

`executions.prepare` and `executions.complete` expose the detached transport.
Preparation owns an internal retry-stable idempotency key. Completion retries
the identical submission/signature and preserves the queued `prepared` status;
it does not claim chain confirmation.

`executions.execute` resolves a local signer before preparation, validates the
server preparation against its locally trusted installation binding and the
original calls, recomputes the canonical EntryPoint 0.7 hash, signs its raw bytes
with EIP-191, verifies the signer address, then completes. Missing local custody
fails closed without contacting the server. A signing callback is invoked once;
completion retries preserve the exact signature. A self-funded request requires
an explicit local maximum gas cost. BSO requests reject nonzero gas fees and
paymaster substitution. Local key exceptions are not returned to callers.

Viem provides hashing/signature verification and Alchemy's installed calldata
codec provides Modular Account V2 encoding. No provider credentials or backend
EVM service are imported by the SDK. Unit tests cover tampered preparations;
transport tests exercise real local secp256k1 signing with injected Fetch and
response loss. CLI keystore resolution is wired; dashboard authorization export
and live-chain client integration are still pending.

`sign` uses detached signature preparation and completion with an explicit
session key ID. It requires local `allowSignatures` consent and `signTypedData`,
recomputes the replay-safe module domain and original payload hash, checks
expiry before and after signing, verifies the secp256k1 signature, and validates
the completed ERC-1271 envelope. `signatures.prepare/complete` expose transport
for clients that implement their own equivalent validation. API signature
quotas govern API completions, not direct signatures created by a local holder.

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

`session-key import` installs encrypted local signing material with a hidden
passphrase prompt and OS-keyring-backed unlock. Execution resolves that material
by API origin/session ID and checks its wallet/chain binding. Self-funded
execution requires an explicit `--max-gas-cost-wei` budget or interactive consent.
See [local keystore](local-keystore.md) for storage invariants and remaining
packaged-platform verification. The same keystore resolves message/typed-data
signers and the local MCP listener. End-to-end browser/local signing verification
remains pending.

Global output is `pretty`, `json`, or `ndjson`. CLI-only typed presenters render
named summaries and labeled sections for wallets, session keys, authorizations,
execution, simulation, and signatures. Shared terminal primitives handle headings,
dates, nested policy fields, and control-character sanitization. Pretty mode is a
human summary; JSON/NDJSON serialize the original result, never the presentation.
MCP stdio remains untouched. `--quiet` suppresses normal stdout. Development defaults to
`http://localhost:8080`; `--host` and `NAMERA_API_URL` override it.

## MCP tools

`namera mcp serve` runs SDK-backed tools over stdio, launched by the agent client.
Browser OAuth uses a temporary loopback callback and persists refreshable MCP
credentials in the OS keyring. CLI login is separate. See
[local MCP authorization](local-mcp.md) for profile isolation, callback security,
cross-process refresh and verification boundaries.

The stdio transport exposes a deliberately compact tool set:

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
