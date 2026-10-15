# CLI

`apps/cli` is a Node.js Effect CLI over the public SDK. Commands handle input,
local authorization, signer resolution, and output. They do not implement server
policy evaluation or access database services.

## Command families

| Command                                  | Responsibility                                        |
| ---------------------------------------- | ----------------------------------------------------- |
| `login`, `logout`, `auth status`         | CLI device authorization and local connection         |
| `wallet list/get`                        | Grant-scoped account discovery                        |
| `session-key list/get/import`            | Session discovery and encrypted local import          |
| `execution simulate/execute/status/list` | Simulation, submission, and status/history            |
| `sign`, `verify-signature`               | Authorized signing and account-signature verification |
| `mcp login/status/logout/serve`          | Separate local MCP connection and stdio service       |

Interactive input resolves namespace, account, session, network, and operation
details. JSON/quiet mode and redirected streams require explicit input.
`--params` decodes the public request schema and cannot be mixed with individual
operation flags. Amounts are wei; network input resolves names, numeric IDs, and
CAIP-2 IDs to supported chains.

## Authentication and profiles

Ordinary CLI login uses OAuth device authorization. Profiles hold nonsecret API
origin and authorization metadata in the local config file; credentials live
in the OS keyring. The default command profile is `personal`.

`NAMERA_API_KEY` selects API-key mode before profile resolution.
`NAMERA_API_URL` selects its API origin, otherwise the SDK production origin
is used. Interactive login accepts `--host` and stores the chosen origin.

Token rotation is serialized with a local SQLite lock. The credential lifecycle
is persisted before refresh; an uncertain refresh requires a fresh login rather
than replaying a possibly consumed token. OAuth HTTP calls refuse redirects and
bound timeouts and response size.

CLI logout removes local credentials and profile state. Server authorization
revocation is a dashboard action. MCP logout has a different revocation lifecycle;
see [MCP](mcp.md).

## Signing

The CLI uses the SDK's execution and signature validation. Local custody resolves
an encrypted imported key; managed custody needs no local file. Authority still
depends on the live grant, session status, policies, and installed permissions.

`--max-gas-cost-wei` supplies explicit self-funded fee consent. Neither an
interactive prompt nor importing a key grants broader transaction authority.
Import verifies the expected API origin without requiring a login.

## Output boundary

Pretty output is a human summary. JSON retains the decoded API response through
the protocol encoder. Quiet mode suppresses successful output, not failures.
Confirmed human execution summaries may make extra detail reads; execution lists
bound those reads to four concurrent requests. JSON and quiet output skip them.

Failures go to stderr with a nonzero exit status. JSON failures expose a bounded
`code`, `message`, `nextStep`, and conservative `retryable` value. The feedback
catalog prevents raw provider, keyring, or schema-input errors from reaching the
terminal. MCP stdout is reserved for protocol messages.

## Source map

- [Commands](../../apps/cli/src/commands)
- [Client authentication](../../apps/cli/src/services/client.ts)
- [Credential lifecycle](../../apps/cli/src/services/cli-session.ts)
- [Cross-process lock](../../apps/cli/src/services/credential-lock.ts)
- [Output formatters](../../apps/cli/src/services/output)
- [Error feedback](../../apps/cli/src/services/error-feedback.ts)
