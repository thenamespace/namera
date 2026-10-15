# Local signing keys

Local session keys are generated and encrypted client-side. The public API
receives the signer descriptor and installation request, not the private scalar.
The SDK, CLI, and local MCP share one export format and Node keystore.

## Trusted authority

`protocol/local` defines versioned key material and encrypted envelopes.
Material binds an exact API origin and secp256k1 key to wallet/session/signing-key
identifiers and per-chain installation authority.

Bindings include account and signer addresses, installation/entity identifiers,
global/execution-hook flags, validity, and explicit signature permission.
`createLocalSessionBindings` checks the registration response against the
owner's original permissions and selected account, including the exact network
set. It is not proof that installation has confirmed onchain.

The SDK compares preparations against these independently retained bindings.
A preparation cannot define the authority used to validate itself.
`allowSignatures` must be explicitly true for local message signing.

## Export encryption

`createLocalSessionKeyDraft` holds private material in a redacted closure. The
dashboard retains the handle outside form/atom state and exports only encrypted
text. Disposal prevents further export; it does not guarantee JavaScript memory
erasure.

| Property                   | Value                                  |
| -------------------------- | -------------------------------------- |
| Cipher                     | AES-256-GCM                            |
| Nonce / authentication tag | Random 96-bit nonce / 128-bit tag      |
| Key derivation             | PBKDF2-HMAC-SHA256, 600,000 iterations |
| Salt                       | Random 128 bits                        |
| Envelope encoding          | Base64url salt, nonce, ciphertext      |
| Authenticated context      | Namera export version, KDF, and cipher |

The codec checks parameters before derivation and verifies that the scalar
matches the public signer bindings. Passphrase strength remains the user's
responsibility. Private material, exports, and passphrases must not enter logs,
telemetry, or API requests.

## Node storage

Import verifies the API origin and decrypts with a hidden passphrase, then
re-encrypts with an independent random OS-keyring secret. It uses a private
temporary file, fsync, and non-overwriting installation. Duplicate imports do
not overwrite an existing key or delete its secret.

Files are addressed by origin hash and session ID. Reads reject symlinks,
nonregular or oversized files, and permissive POSIX file modes. Directories use
0700 and files 0600 on POSIX. Missing files or unavailable keyring access fail
closed without plaintext fallback.

| Platform                            | Configuration directory                |
| ----------------------------------- | -------------------------------------- |
| macOS                               | `~/Library/Application Support/namera` |
| Windows                             | `%APPDATA%/Namera`                     |
| Linux                               | `~/.config/namera`                     |
| Any platform with `XDG_CONFIG_HOME` | `$XDG_CONFIG_HOME/namera`              |

Keys live in the `session-keys` subdirectory. Linux Secret Service provides
persistent keyring storage; the keyutils fallback is memory-only.

Node's SDK resolver loads a key only for a local signing challenge and does not
cache decrypted material between operations. CLI and MCP reuse it. Browsers use
an explicit resolver and do not bundle the native store.

Import origin precedence is `--host`, `NAMERA_API_URL`, then saved profile.
A missing personal profile uses the production origin; a missing named profile
needs an explicit host. Import does not create a login grant or install authority.

## Source map

- [Local schemas](../../packages/protocol/src/local)
- [Export codec](../../packages/sdk/src/signing/keystore.ts)
- [Registration binding](../../packages/sdk/src/signing/session-registration.ts)
- [Encrypted Node storage](../../packages/sdk/src/node/storage.ts)
- [Signer resolver](../../packages/sdk/src/node/resolver.ts)
- [CLI import](../../apps/cli/src/commands/session-key/import.ts)
