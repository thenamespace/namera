# @namera-ai/wallet-provider-local

Private development filesystem signer. `LocalService` creates, signs with,
disables and destroys keys. It is not a fallback custody provider. The server
currently composes `disabledLayer`.

## Storage

`LocalService.layer` reads `WALLET_KEYS_LOCAL_DIRECTORY`, defaulting to
`.data/wallet-keys/` at the repository root. Directories use `0700`; new files use
`0600` and exclusive creation. A signing-key-ID filename contains versioned JSON
with the algorithm, PKCS#8 private key and active/disabled status. Disablement
updates status; destruction removes the file. Keep this directory out of Git.

## Signing

P-256, secp256k1 and Ed25519 are supported. All material is software-held,
regardless of protection-shaped input compatibility. ECDSA messages are hashed
once with SHA-256; Ed25519 signs directly. ECDSA `signDigest` takes exactly 32 bytes
without rehashing and returns low-S DER. Chain adapters own final formatting.

`disabledLayer` rejects operations without filesystem access. `testLayer`
returns synthetic results. Tests of the real layer use disposable directories
and verify signatures, file permissions and key lifecycle.

## Development

```sh
pnpm --filter @namera-ai/wallet-provider-local test
pnpm --filter @namera-ai/wallet-provider-local typecheck
pnpm --filter @namera-ai/wallet-provider-local build
```

See [account custody](../../../architecture/wallet-system/accounts.md).
