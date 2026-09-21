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
namera session-key list
namera wallet get <wallet-id>
namera session-key get <session-key-id>
```

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

Commands prompt for inputs. For automation, pass `--params '<json>'` using the
public request shape. Execution/signing requires an imported key, active grant,
and appropriate authority. Gas is sponsored by default. Self-funded operations
also require `--max-gas-cost-wei <amount>`; MCP tools cannot raise that ceiling.

## Script-friendly output

```sh
namera --output json wallet list
namera --output ndjson session-key list
namera --quiet auth status
```

Human-readable summaries are the default. JSON includes complete response fields;
NDJSON emits one document per top-level list item. `NO_COLOR` disables styling.
MCP reserves stdout for the protocol and writes diagnostics to stderr.

For headless API-key use, supply `NAMERA_API_KEY` through the environment;
`NAMERA_API_URL` overrides the default host. API keys take precedence over
ordinary CLI profile credentials, but do not authorize MCP.

## Sign out

```sh
namera logout
namera mcp logout --profile codex
```

Logout revokes that authorization, not other profiles or signing keys. macOS
Keychain integration is tested; Windows/Linux still need platform verification.
Headless Linux needs an accessible Secret Service/keyring. There is no plaintext
or in-memory fallback.

See [local MCP](https://github.com/thenamespace/namera-core/blob/main/architecture/clients/local-mcp.md)
and [key storage](https://github.com/thenamespace/namera-core/blob/main/architecture/clients/local-keystore.md).
The four public packages share a release version starting with 1.0.0.

The CLI includes an npm shrinkwrap to keep its tested runtime dependencies together.
Update with `npm install -g @namera-ai/cli@latest`; no separate Effect installation
is needed. This does not change your saved profiles or local keys.
