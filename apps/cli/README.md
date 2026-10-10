# @namera-ai/cli

Use Namera from your terminal, Codex, or Claude Code. Import encrypted session
keys and execute within the permissions you approved. The CLI includes a local
**stdio MCP server** that your agent client starts automatically.

## Installation

Requires **Node.js 24.14+** and an available operating-system keyring.

```sh
npm install -g @namera-ai/cli
pnpm add -g @namera-ai/cli
yarn global add @namera-ai/cli
bun add -g @namera-ai/cli
```

Choose one command. `yarn global` requires Yarn Classic; with modern Yarn use
`yarn dlx @namera-ai/cli --help` or install globally with npm/pnpm.
Bun can install the package, but the executable runs on Node.js.

```sh
namera --help
namera --version
```

## Sign in and inspect wallets

```sh
namera login
namera wallet list
namera wallet get
namera session-key list
namera session-key get
namera wallet get <wallet-id>
namera session-key get <session-key-id>
```

`wallet get` opens a keyboard picker with wallet names, status, and addresses.
Use the arrow keys and Enter to select, or Ctrl+C to cancel. For scripts, JSON
output, or quiet mode, supply the wallet ID explicitly; the CLI never prompts
when input or output is redirected.

`session-key get` likewise opens a key picker showing only key names and their
owning account names. Supply an ID for non-interactive use. Human details start
with the key name and status, then account, creation, expiry, and installed
networks. Permissions and API policies follow, without internal IDs or versions.
Network-specific limits and expiry dates remain visible, and pending approvals
are distinguished from enabled permissions. JSON retains every field.

Login opens browser consent to choose access. Credentials persist in the OS
keyring, so you do not sign in for every command. The default API is
`https://api.namera.ai`.

For your first session key, complete the import and network approval below
before logging in. Only active keys can be authorized.

For local development:

```sh
namera login --profile dev --host http://localhost:8080
namera wallet list --profile dev
```

## Import a session key

Create a key in the dashboard and encrypt its export. Import it before logging
in, using the command shown in the dashboard:

```sh
namera session-key import <encrypted-export> --host https://api.namera.ai
```

The export passphrase is entered privately. The CLI re-encrypts the key with an
independent OS-keyring secret and stores an encrypted local file. It never falls
back to plaintext storage. Keep your encrypted backup and passphrase safe.
Importing does not install the key onchain or grant a client access to it.
Return to the dashboard and approve at least one network, then run `namera login`
and select the now-active key. Other networks can be approved later.

Import is local and needs no API credentials. Its expected API origin comes from
`--host`, then `NAMERA_API_URL`, then the saved `--profile` (default `personal`).
Before the first login, the personal profile defaults to `https://api.namera.ai`.
For a new custom profile, pass `--host` explicitly. The encrypted export must
match that origin; importing does not create a login profile.

## Connect an agent

Register once with your chosen client:

```sh
# Codex
codex mcp add namera -- namera mcp serve --profile codex

# Claude Code
claude mcp add --transport stdio --scope user namera -- namera mcp serve --profile claude
```

Other MCP clients use command `namera` and arguments
`["mcp", "serve", "--profile", "agent"]`.

The stdio server supports MCP `2026-07-28`, `2025-11-25`, and `2025-06-18`.
Newer clients use request-scoped protocol metadata; the two older revisions
retain initialization-based negotiation. No protocol flag is needed.

Your client starts the process: no manual daemon or HTTP MCP endpoint is needed.
First tool use opens browser authorization. Approve access to installed session
keys and retry the tool after consent. If the browser cannot open:

```sh
namera mcp login --profile codex
namera mcp status --profile codex
```

MCP authorization is separate from ordinary CLI login. Use the same profile and
`--host` for serve/login/status/logout. Import signing keys on this machine
before executing or signing. Credentials survive restarts. The CLI does not
automatically export telemetry from your machine.

## Simulate, execute, and sign

```sh
namera execution simulate
namera execution execute
namera execution status <submission-id>
namera execution list
namera sign
namera verify-signature
```

`execution list` shows each account with full transaction and UserOp hashes,
the network name, the actor name and source (MCP, CLI, API Key, or Dashboard),
and the session key. CLI actors use their device name; MCP actors use their
client name. Human output reads execution details with bounded concurrency;
JSON keeps the original paginated list response and IDs without extra requests.

`execution status <submission-id>` uses the same account and transaction summary
when confirmed, plus a colored status. Pending states read "Awaiting signature",
"Queued", or "Pending confirmation", with a UserOp hash when available and a
relevant next step. Failed submissions do not display a fabricated failure reason.
JSON retains the original submission response; only confirmed human output makes
the additional execution-details read.

These four commands prompt only for missing inputs, in order: network type,
wallet, session key, network, then transaction or signature details. Wallets are
filtered by network type and session keys by wallet. Verification skips the
session-key picker: it checks a wallet signature, not which key signed it.
Use arrow keys and Enter to select, or Ctrl+C to cancel.

```sh
namera execution execute --namespace evm
namera execution simulate --namespace evm --wallet <wallet-id> \
  --session-key <key-id> --network Base --to <recipient-address> --value 0 --data 0x
namera sign --namespace evm --wallet <wallet-id> --session-key <key-id> \
  --network Base --type message --message 'Hello'
namera verify-signature --namespace evm --wallet <wallet-id> --network Base \
  --type message --message 'Hello' --signature <hex-signature>
```

Networks accept names, numeric chain IDs, or `eip155:<chain-id>`. Transaction
values are **wei**, not ETH. Use `--type typed-data --typed-data '<json>'` for
EIP-712. Execute additionally accepts `--sponsor true|false`.
Every omitted input prompts in a terminal; JSON, quiet mode, and pipes instead
return a missing-flag error. Individual flags require wallet/session-key read
access to validate the selection. For batch calls or existing headless scripts,
pass `--params '<json>'` using the public request shape; it retains its existing
permission requirements. Do not mix `--params` with individual input flags.

Human summaries use arrow rows, account/key names when selected interactively
or with individual flags, and network names. JSON retains all response details.
Execution/signing uses the same commands for local and 1Claw-managed session keys.
Local keys require import; managed keys need no key file. Both require an active
grant and appropriate installed authority. Account ownership is independent of
session custody. A lost managed-signature response is not automatically retried;
a new signing attempt may consume another signature allowance. Gas is sponsored by default. Self-funded operations
also require `--max-gas-cost-wei <amount>`; MCP tools cannot raise that ceiling.

## Script-friendly output

```sh
namera --output json wallet list
namera --output json session-key list
namera --quiet auth status
```

Human-readable summaries are the default: colored status, wallet-grouped keys,
and plain-language permissions. Labels and section titles use cyan, account names
use bold magenta, and key names use bold terminal text. Key summaries include
status and relative expiry; different network expiries are labeled explicitly.
Permissions and keys
use blue arrows, with unindented account headings separated by a blank line.
Session-key lists show one compact key summary and a names-only Networks row;
only installed networks within their permission time window are listed as active.
JSON includes complete response fields and IDs;
use it when copying IDs for commands or scripts. NDJSON is no longer supported.
`NO_COLOR` disables styling. Organization names require a server that includes
them in its current-actor response; older servers show an unavailable-name notice.
MCP reserves stdout for the protocol and writes diagnostics to stderr.

Failures exit with a nonzero status and write a concise message and recovery
step to stderr, without stack traces or raw provider details. Supported terminals
show red errors, yellow warnings, and blue next steps with symbols. Human output
does not show error codes or field labels. Pipes, `TERM=dumb`, and legacy
consoles use plain/ASCII fallbacks; `NO_COLOR` disables colors.
`--quiet` suppresses successful output, not errors. With `--output json`,
the failure is one JSON object on stderr:

```json
{
  "error": {
    "code": "INVALID_EXPORT",
    "message": "The encrypted session-key export is invalid or incomplete.",
    "nextStep": "Copy the entire import command from the dashboard. Do not paste a private key.",
    "retryable": false
  }
}
```

Use `code` for automation and `nextStep` for recovery. `retryable: false` means
do not automatically repeat the command; an ambiguous transfer may already have
been submitted. MCP tool failures retain `isError`, matching text/structured
results, and include `nextStep`. Neither format exposes raw causes or stacks.
Unexpected failures use `INTERNAL_ERROR`; report the command name and CLI version
to support, never credentials or encrypted exports.

For headless API-key use, supply `NAMERA_API_KEY` through the environment;
`NAMERA_API_URL` overrides the default host. API keys take precedence over
ordinary CLI profile credentials, but do not authorize MCP.

## Sign out

```sh
namera logout
namera mcp logout --profile codex
```

CLI logout removes this device's saved connection, not its imported signing keys
or server authorization. Revoke the authorization in the dashboard to end its
server-side access. MCP logout revokes its separate MCP authorization. macOS
Keychain integration is tested; Windows/Linux still need platform verification.
Headless Linux needs an accessible Secret Service/keyring. There is no plaintext
or in-memory fallback.

See [local MCP](https://github.com/thenamespace/namera/blob/main/architecture/clients/local-mcp.md)
and [key storage](https://github.com/thenamespace/namera/blob/main/architecture/clients/local-keystore.md).
The four public packages share a release version starting with 1.0.0.

The CLI includes an npm shrinkwrap to keep its tested runtime dependencies together.
Update with `npm install -g @namera-ai/cli@latest`; no separate Effect installation
is needed. This does not change your saved profiles or local keys.
