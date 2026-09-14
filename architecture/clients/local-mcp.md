# Local MCP authorization

`namera mcp serve` runs ten SDK-backed tools over stdio. The parent MCP client
starts and stops the process; no permanent HTTP listener or local OAuth issuer
exists. The API retains OAuth registration, browser consent, token, refresh,
revocation and authorization management. No database backfill is required.

## Setup

After installing the CLI and importing the session key:

```sh
codex mcp add namera -- namera mcp serve --profile codex
claude mcp add --transport stdio --scope user namera -- namera mcp serve --profile claude
```

For other local clients, configure command `namera` and arguments
`["mcp", "serve", "--profile", "agent"]`. GUI clients may need the absolute
executable path. Cloud-only clients cannot launch this local process.

All MCP commands accept `--host` (API origin, default `http://localhost:8080`)
and `--profile` (default `default`). Profiles separate saved grants, not OS
identities: another process under the same OS user may select the same profile.
CLI login and `NAMERA_API_KEY` are not used for MCP authorization.

## OAuth lifecycle

Initialization and tool discovery do not require credentials or wait on login.
The first tool call without usable credentials starts browser consent once per
process and returns an actionable unauthorized result. The user retries after
consent. `namera mcp login --profile agent` provides explicit login when automatic
opening is unavailable. Login prints a fallback URL to stderr, never to MCP stdout.

Each consent uses a newly registered public native client, random state and S256
PKCE. A temporary listener binds an OS-assigned IPv4 loopback port and accepts
only the exact callback path/Host, matching state, and one code or denial. It
rejects duplicate fields, Origin-bearing requests, wrong states and replay.
The five-minute deadline, cancellation and completion close the listener.
The registered callback is used exactly in the code exchange. Outbound OAuth
requests target only the configured API origin, refuse redirects, and have
bounded bodies and timeouts.

Credentials are stored as one schema-validated bundle in the OS keyring under
`namera-mcp`, indexed by a hash of API origin and profile. Access/refresh tokens,
client ID, scopes, expiry and lifecycle generation never go into client config
or plaintext files. Keyring failures have no plaintext fallback. Imported signing
keys remain in their separate encrypted keystore.

A per-profile SQLite transaction provides cross-process exclusion using Node's
built-in SQLite module. Its private file in the CLI config directory contains no
credentials or application records. The OS releases the lock on process death.
Each process rereads keyring credentials under the lock before refresh. Tokens
are marked `refreshing` before rotation; ambiguous failure or a crash requires
fresh consent, never replay of a potentially consumed refresh token. Refresh
cannot expand scopes. Concurrent login/logout is protected by a generation check.

`namera mcp status` reports local saved state, not a guarantee that server-side
access remains active. `namera mcp logout` disables local credentials and requests
server revocation. If revocation fails it reports this explicitly and directs
the user to revoke through settings. Signing keys are not deleted.

## Tool authorization and signing

Every tool call obtains current credentials and reloads the API actor and live
grants. Effective scopes intersect the token's scopes with live authorization.
Before opening any key, the resolver verifies the requested session, wallet,
namespace and active status against those grants. The SDK checks the prepared
payload against the imported binding before signing; the API rechecks authority
on completion. Expired/revoked authorization never permits offline signing.

No tool accepts private keys, filesystem paths, credentials or a fee ceiling.
`--max-gas-cost-wei` sets the user-owned fee ceiling for self-funded operations;
omitting it permits sponsored operations only. Repeating an execution tool can
transfer twice; descriptions direct clients to poll submission status instead.

Stdout contains only MCP protocol messages during serving. Diagnostics go to
stderr. Closing stdin disposes the transport and cancels pending login. The tool
error boundary returns bounded messages and validated policy diagnostics, not
raw provider or keystore errors. Existing tool metrics use fixed tool names only.

## Verification

Integration tests cover real loopback callbacks, state/replay/denial guards,
restart restoration, rotating refresh serialization, ambiguous refresh failure,
logout racing consent, and stdio initialize/list/call boundaries. They verify
live revocation and scope/grant narrowing. Encrypted-key signing traverses the
real local keystore, signer resolver and SDK, with cryptographic verification;
the OS keyring and upstream API are substituted in that test.

A subprocess test starts the actual CLI source with stdin/stdout pipes, checks
protocol-only output and discovery without login, and verifies exit on stdin EOF.
Existing opt-in OS-keyring tests remain separate. Physical browser/agent consent
with this new transport and Windows/Linux keyring behavior still require manual
platform verification. The former HTTP transport's live Sepolia result is not
evidence that the new stdio/browser flow has been exercised end to end.
