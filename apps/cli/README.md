# `@namera-ai/cli`

Effect CLI client for Namera. It authorizes a local profile through OAuth 2.1
device authorization, stores refreshable credentials in the operating-system
keyring, and uses `@namera-ai/sdk` for typed wallet operations.

## Commands

```sh
namera login --profile personal --host https://api.namera.ai
namera auth status --profile personal --json
namera wallet list
namera wallet get <wallet-id>
namera session-key list [--wallet <wallet-id>]
namera session-key get <session-key-id>
namera execution execute --file request.json
namera execution status <submission-id>
namera execution get <execution-id>
namera execution list [--cursor <execution-id>]
namera sign --file request.json
namera logout
```

Structured transaction and signature payloads are read from JSON files so they
can be validated with the public protocol schemas without fragile shell
quoting. Use `--json` for machine-readable output.

## Credentials

Profile metadata is stored in the platform configuration directory. Access and
refresh tokens are stored only through `@napi-rs/keyring`. The CLI does not
silently fall back to plaintext credentials. `NAMERA_API_KEY` is supported for
headless automation and takes precedence over profile credentials.

Refresh-token rotation is guarded by a cross-process profile lock. Commands
re-read the keyring after acquiring that lock before deciding whether a refresh
is necessary.
