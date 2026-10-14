# @namera-ai/passkeys

WebAuthn registration and authentication verification through an Effect service.
This private package owns SimpleWebAuthn integration, not ceremony persistence,
tenant authorization or wallet transaction encoding.

Registration requests resident ES256 credentials with user verification. Verification
binds responses to the expected challenge, origin and RP ID, and returns an
uncompressed P-256 public key with credential metadata.

Authentication uses an operation digest as the challenge and allows the exact
owner credential. Verification checks credential ID, origin, RP ID, public key,
user presence/verification and counter, and rejects cross-origin ceremonies.
It returns verified assertion bytes for the chain adapter.

Application workflows consume challenges and update counters atomically. Synced
passkeys may keep a zero counter; challenges must still be single use. Nonzero
counters must increase.

## Development

```sh
pnpm --filter @namera-ai/passkeys test
pnpm --filter @namera-ai/passkeys typecheck
pnpm --filter @namera-ai/passkeys build
```

The `@namera-ai/passkeys/testing` entry supplies ephemeral signed registration and
assertion fixtures. It is for isolated tests, never production composition. No
environment variables are read here; callers supply expected ceremony values.

See [authentication boundaries](../../architecture/identity-access/authentication.md).
