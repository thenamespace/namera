# Google Cloud KMS wallet provider

`@namera-ai/wallet-provider-gcp` owns KMS key creation, signing, disablement and
destruction. Application workflows consume `GcpService` directly. There is no
shared provider interface or fallback to local keys.

## Service and configuration

`GcpService.layer` scopes the Google client and closes it on release. It reads
`GCP_PROJECT_ID`, `GCP_KMS_KEY_RING`, and `GCP_KMS_LOCATION` (default `global`).
Authentication uses Google Application Default Credentials. The key ring must
already exist and IAM must permit the requested operations.

The service exposes `createKey`, `signMessage`, `signDigest`, `disableKey`, and
`destroyKey`. Operation schemas and `GcpKeyError` belong to this package. Shared
persisted locators remain in protocol. The caller supplies a preallocated
signing-key ID; KMS names remain `wallet-<id>` with a pinned key-version locator.
Creation returns only public material and that locator. It never exports private
keys, writes database rows, or retries ambiguous creation.

P-256 and Ed25519 accept software/HSM protection; secp256k1 requires HSM.
ECDSA message signing hashes once with SHA-256; Ed25519 signs raw messages.
`signDigest` accepts exactly 32 bytes for P-256/secp256k1 without rehashing.
ECDSA signatures are DER; EVM owns chain-specific formatting. KMS response names,
request-integrity flags and CRC32C checks are verified before returning results.

`disabledLayer` requires no configuration and rejects every operation. The server
uses this layer in all environments while managed custody is gated.
`testLayer` returns deterministic synthetic results for application boundary tests,
not cryptographically valid signatures.

## Development

```sh
pnpm --filter @namera-ai/wallet-provider-gcp test
pnpm --filter @namera-ai/wallet-provider-gcp typecheck:test
pnpm --filter @namera-ai/wallet-provider-gcp build
```

Provider tests substitute the Google SDK transport and exercise request mapping,
digest semantics, integrity failures, lifecycle calls and client release. They do
not call live KMS. Exports retain `namera-source` and an unbundled production build.
