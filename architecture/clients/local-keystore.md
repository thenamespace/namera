# Local session key exports

The client-only `@namera-ai/protocol/local` entry point defines the browser-to-CLI
export format. It is not an HTTP request/response or server persistence model.

## Plaintext inside encryption

`LocalSessionKeyMaterial` version 1 contains the EVM namespace, exact API origin,
a redacted secp256k1 private scalar, and public installation bindings. Bindings
identify one wallet/session/signing key across distinct supported chains, with
the wallet and signer addresses, installation ID, validator entity, global flag,
execution-hook flag, and finite validity interval. The SDK uses these local
bindings rather than trusting a server preparation to identify its authority.
Bindings also carry optional `allowSignatures`; only explicit true allows local
message/typed-data signing. Omission denies signing without changing execution
authority. Export this value from the owner's approved installation, not from
a later server challenge.

Before encryption and after decryption, the SDK derives the signer address from
the private key and checks every binding. This proves key correspondence, not
that the installation is actually approved or deployed. The dashboard must
construct the export from the owner-approved installation; the import flow must
check the active API origin and installation lifecycle before use.

`createLocalSessionBindings` verifies a decoded registration against the caller's
original request and separately selected wallet. The network set must match
exactly. Wallet and signer addresses, ordered permissions (including exact base
units), validity and signature consent must be unchanged. Root determines the
global flag; native/ERC-20 spend permissions determine Alchemy's execution-hook
wrapper. Gas/time/allowlist validation hooks do not enable that wrapper.
The helper retains server-assigned installation/entity identifiers, which must
also be checked when approving installation calldata. It does not establish
onchain authority, approve a passkey challenge, or check receipt state.

## Encryption

The SDK's `createLocalSessionKeyDraft` is a client-only generation handle. A
secp256k1 private scalar stays in a redacted closure; its public registration
descriptor and address can enter UI/API state. `seal` delegates to the shared
codec using caller-supplied owner-approved bindings. Keep the handle in a ref,
not a form, atom, URL or storage entry. `dispose` drops the redacted reference
and prevents new or pending exports from being returned. This is lifecycle
control, not guaranteed memory erasure or proof of owner approval.

`sealLocalSessionKey` and `openLocalSessionKey` in the SDK use platform WebCrypto:

- AES-256-GCM with a random 96-bit nonce and 128-bit authentication tag.
- PBKDF2-HMAC-SHA256, fixed 600,000 iterations, random 128-bit salt.
- Fixed authenticated domain identifying Namera, export version, KDF and cipher.
- Base64url salt, nonce and ciphertext; no plaintext account metadata in the
  envelope. Unsupported versions/KDF parameters are rejected before derivation.

Use a strong, preferably generated passphrase and deliver it separately from the
encrypted export. The codec refuses an empty password but cannot establish the
entropy of a user-selected password. Both password and decrypted key are
`Redacted` values. Buffer clearing is best effort; JavaScript strings, garbage
collection and third-party signing libraries prevent guaranteed memory erasure.
No private key, passphrase, decrypted JSON or raw schema/provider exception may
be sent to telemetry, the Namera API, shell arguments, or command history.

## CLI storage and resolution

`session-key import` decodes the encrypted export, prompts for a hidden
passphrase, and checks its exact API origin without requiring login. Expected
origin precedence is `--host`, `NAMERA_API_URL`, then the saved `--profile`
(default `personal`). A missing personal profile uses the SDK production origin;
a missing named profile requires an explicit host. Import never creates a grant
or reads OAuth credentials. It
re-encrypts the material with a random independent OS-keyring secret. A private
temporary file is synced and installed through a non-overwriting hard link;
failed installation attempts remove their own unlock secret, not an existing
import's secret. POSIX directories/files use 0700/0600 permissions.

Import preserves typed failures through the CLI boundary: invalid export,
decryption failure (wrong passphrase or damaged export), wrong API origin,
already-imported key, unavailable keyring, and other safe-storage failures.
Cleanup failures remain storage failures rather than claiming a clean duplicate
import. Feedback gives recovery instructions without exposing native exceptions,
export contents, or passphrases. No error path overwrites an existing key or
falls back to plaintext credentials.

Files are addressed by an API-origin hash and validated session ID. Reads reject
symlinks, non-regular files, oversized files, and permissive POSIX file modes.
Missing keyring access fails closed. The resolver checks wallet and chain
bindings before providing the local signer to the SDK. The server independently
checks current installation/grant authority during preparation and completion.

## Verification and pending integration

Schema tests cover validity, duplicate chains, inconsistent wallet bindings and
unsafe API origins. SDK tests cover encryption round trips, randomized envelopes,
wrong passwords, ciphertext tampering, KDF changes and signer/key mismatch.
These tests do not prove an installed-session or browser import journey.
CLI tests exercise actual temporary files with a substitute keyring, including
duplicate-import preservation, origin mismatch, unavailable unlock, private file
modes, and encrypted round trips. The CLI build and import help smoke test pass.

- Generation-handle tests cover real encrypted round trips, signer mismatch,
  corrected retry, and disposal during encryption. No private material is part
  of the handle's serialized shape.
- Browser generation and encrypted export are connected to registration. The key
  handle remains in a ref, navigation warns before losing an unsaved draft, and
  only the encrypted command enters the clipboard. A disposable isolated browser
  preview verified encryption; no live registration/import journey is claimed.
- Pending: connect owner approval and receipt polling, and recover ambiguous
  registration responses without replacing or losing the original draft.
- Registration-binding regressions reject response substitutions for wallets,
  signers, networks, expiry, signature consent, root authority and exact spend.
- Pending: real OS-keyring and owner-approved import-to-execution journeys.
- Pending: local MCP reuse, removal/backup UX, and packaged platform tests.
