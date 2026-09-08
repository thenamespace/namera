# `@namera-ai/passkeys`

Provider-neutral WebAuthn ceremony generation and verification for Namera.
The package owns the SimpleWebAuthn dependency and exposes Effect services;
application workflows own persistence and tenant binding.

Registration options require resident credentials, user verification, and
ES256. Verification checks the response against the exact stored challenge,
origin, and RP ID, then returns a normalized uncompressed P-256 public key plus
credential metadata. It never persists data or receives private key material.

Authentication options accept exact operation digest bytes and allow only the
wallet owner's credential, with user verification required. Authentication
verification binds credential ID, challenge, origin, RP ID, P-256 public key
and counter; cross-origin ceremonies are rejected. It returns verified
authenticator/client bytes and DER signature for namespace-owned transaction
encoding. Application workflows must consume the operation challenge and update
the counter atomically; this service alone provides no replay persistence.

Synced passkeys may consistently use counter zero. Nonzero counters must
increase. A challenge must still be single-use even when counters are zero.

`pnpm --filter @namera-ai/passkeys test` exercises the live verifier with
generated P-256 packed self-attestations, including challenge/origin/RP mismatch,
missing user presence or verification, and a corrupted signature. These tests
do not substitute for browser authenticator integration tests.

`createTestAuthenticator()` from `@namera-ai/passkeys/testing` supplies ephemeral signed assertions for package and
HTTP integration tests. It retains the private key inside its closure. Its
optional test layer replaces registration only to provision that public key;
authentication still runs the live verifier. Never compose it into a server
runtime layer.

`createTestRegistration()` from the same testing entry produces a fresh P-256
packed self-attestation for a supplied challenge, origin and RP ID. Both the
package verifier tests and multi-user HTTP wallet-cap tests use it with
`Passkeys.layer`, without replacing registration verification. It returns only
the public key and registration response, never the private key.
