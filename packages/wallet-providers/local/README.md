# Local wallet provider

`@namera-ai/wallet-provider-local` owns development-only filesystem keys through
`LocalService`. Application code opts into this service explicitly; it is not a
fallback for GCP or 1Claw and does not provide HSM isolation.

## Service and storage

`LocalService.layer` reads `WALLET_KEYS_LOCAL_DIRECTORY`. Its default remains the
repository's `.data/wallet-keys/` for source and unbundled builds. The provider split
does not relocate or regenerate keys. Directory permissions are `0700`; new files
are `0600` and use exclusive creation so an existing key is never overwritten.

Version-1 JSON files retain their signing-key-ID filename, algorithm, PKCS#8
private key and active/disabled status. Never commit this directory or expose its
contents. Disablement persists status; destruction removes the file.

The service exposes `createKey`, `signMessage`, `signDigest`, `disableKey`, and
`destroyKey`. Operation schemas and `LocalKeyError` belong here; shared persisted
locators remain in protocol. No database or application dependencies are present.

P-256, secp256k1 and Ed25519 are supported. Legacy protection-shaped inputs are
preserved (including secp256k1's `hsm` input restriction) solely for compatibility;
all local material is software-held. ECDSA messages are hashed once with SHA-256;
Ed25519 signs directly. `signDigest` accepts exactly 32 bytes for P-256/secp256k1,
with no prehashing. ECDSA output is low-S DER; EVM owns final signature formatting.

`disabledLayer` needs no configuration or filesystem access and rejects all
operations. The server uses it in every environment while managed custody is
gated. `testLayer` produces deterministic synthetic metadata/signatures for
application tests. It is not the cryptographic implementation.

## Development

```sh
pnpm --filter @namera-ai/wallet-provider-local test
pnpm --filter @namera-ai/wallet-provider-local typecheck:test
pnpm --filter @namera-ai/wallet-provider-local build
```

Tests use disposable directories, verify actual signatures, and cover persisted
keys, permissions, duplicate creation, disablement, destruction and invalid
requests. Exports retain `namera-source` and the unbundled build convention.
