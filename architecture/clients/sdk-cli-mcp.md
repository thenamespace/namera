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
- `executions.simulate`, `execute`, `getStatus`, `get`, and `list`;
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
accept schema-decoded inline `--params` JSON or optional individual flags with
typed prompts for missing fields. Selectors resolve namespace, wallet, and
wallet-scoped session key before collecting the operation payload; supplied IDs
are read back and checked for wallet/namespace mismatches. This path needs read
scopes. Legacy `--params` keeps its existing transport-only permissions and batch
support, and cannot be mixed with individual payload flags. JSON/quiet/non-TTY
commands fail on missing inputs rather than opening prompts. Verification omits
session-key selection because the API verifies the wallet signature. No
request-file input exists.

`session-key import` installs encrypted local signing material with a hidden
passphrase prompt and OS-keyring-backed unlock, without requiring login.
First-time setup imports the encrypted key,
approves a network in the dashboard, then logs in to grant the active key.
Execution resolves local material by API origin/session ID and checks its
wallet/chain binding. Self-funded
execution requires an explicit `--max-gas-cost-wei` budget or interactive consent.
See [local keystore](local-keystore.md) for storage invariants and remaining
packaged-platform verification. The same keystore resolves message/typed-data
signers and the local MCP listener. End-to-end browser/local signing verification
remains pending.

Global output is `pretty` or `json`. CLI-only typed presenters render
named summaries and labeled sections for wallets, session keys, authorizations,
execution, simulation, and signatures. Shared terminal primitives handle headings,
dates, nested policy fields, and control-character sanitization. Pretty mode is a
human summary; JSON serializes the original result, never the presentation.
Human execution lists expand the current page through `executions.get`, with
four concurrent reads at most, to show UserOp hashes and actor names. They retain
list order and the original next-page cursor. JSON and quiet mode skip detail
reads. Detail failures use normal command error handling, never fabricated names.
Confirmed human submission status uses the same details read and presentation,
with a colored status. Pending/failed output stays submission-only with actionable
labels and no internal ID fields; JSON and quiet status skip expansion.
Authorization summaries resolve wallet names through grant-scoped wallet reads
only in pretty mode with wallet-read scope. They group keys by wallet ID, translate
scope labels, and retain raw IDs/scopes in JSON. With session-key-read scope,
pretty authorization status also reads granted session details for network expiry.
Key summaries display relative expiry, expired state, or explicitly differing
network expiries; missing details are never interpreted as unlimited duration.
Section titles, account names, and key names have distinct terminal styles.
Login instructions go to stderr
so successful JSON stdout remains one document. Login/logout successes use green
feedback and blue next steps; logout still only removes local CLI credentials.
MCP login/status/logout have typed human summaries, readable permissions, and
automatic-refresh versus reconnect guidance. Browser authorization instructions
stay on stderr; JSON response shapes and MCP protocol stdout remain unchanged.
`--quiet` suppresses normal stdout. Development defaults to
`http://localhost:8080`; `--host` and `NAMERA_API_URL` override it.

Command failures use a CLI-owned feedback catalog with stable codes, concise
messages, recovery steps, and conservative retry guidance. Human errors go to
stderr; JSON mode emits a JSON error object there. Quiet mode does not
suppress failures. Parser errors avoid echoing user input, help still exits
successfully, and the runtime does not print stacks. SDK codes are translated
without rendering raw provider messages or schema inputs. Credential access
and deletion failures are reported instead of silently claiming successful
logout. No new audit event is needed: this changes local feedback, not server
authorization or persisted business state.

Human feedback uses stderr's TTY/color support: red errors, yellow warnings,
and blue recovery steps, without codes or field labels. Unicode symbols have
ASCII fallbacks for pipes, dumb terminals, legacy Windows consoles, and C/POSIX
locales. `NO_COLOR` and `FORCE_COLOR=0` disable color. Warning presentation does
not change failure exit codes or structured error fields. JSON and MCP remain
unstyled and retain machine-readable codes.

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

## Published dependency checks

The four public packages share a fixed Changesets release group. Effect runtime
dependencies use exact catalog versions. The CLI additionally ships an npm
shrinkwrap: transitive Effect prerelease ranges must not float independently of
the tested core version. `pnpm cli:lock` refreshes it; versioning/prepack only
synchronize sibling versions and reject stale direct dependency declarations.

`pnpm pack:check` serves candidate tarballs from a temporary loopback registry and
performs clean npm installs outside the workspace. It tests CLI startup, login/MCP
help, SDK request decoding, protocol schemas and API OpenAPI generation. No login,
keyring mutation or production request is performed. Both CI and Release run it.

## Pending

- Test packaged CLI profiles and keyrings on macOS, Windows, and Linux and test
  two-process refresh contention against a live server.
- Add convenience SDK polling only after real client usage validates the
  desired behavior.
- Add specialized high-level MCP transaction tools only when they reduce schema
  ambiguity without duplicating the generic execute boundary.
