# `@namera-ai/passkeys`

Provider-neutral WebAuthn ceremony generation and verification for Namera.
The package owns the SimpleWebAuthn dependency and exposes Effect services;
application workflows own persistence and tenant binding.

Registration options require resident credentials, user verification, and
ES256. Verification checks the response against the exact stored challenge,
origin, and RP ID, then returns a normalized uncompressed P-256 public key plus
credential metadata. It never persists data or receives private key material.
