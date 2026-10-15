# @namera-ai/wallet-provider-gcp

Private Google Cloud KMS adapter. `GcpService` creates, signs with, disables and
destroys keys. It returns public material and provider locators, never private keys.
The current server composes `disabledLayer`; public managed accounts use 1Claw.

## Configuration and lifecycle

`GcpService.layer` uses Application Default Credentials, `GCP_PROJECT_ID`,
`GCP_KMS_KEY_RING` and `GCP_KMS_LOCATION` (default `global`). The key ring and IAM
access must exist. The scoped Google client closes when its layer is released.

The caller supplies the signing-key ID. Creation uses `wallet-<id>` and returns
a pinned key-version locator. The adapter neither persists database records nor
automatically retries ambiguous creation.

## Signing

P-256 and Ed25519 support software or HSM protection; secp256k1 requires HSM.
ECDSA `signMessage` hashes once with SHA-256; Ed25519 signs raw messages.
`signDigest` accepts exactly 32 bytes for ECDSA without rehashing. ECDSA output is
DER; the EVM package owns validator formatting. Response names, integrity flags
and CRC32C checks are verified.

`disabledLayer` rejects every operation without configuration. `testLayer`
returns synthetic results for boundary tests, not valid cryptographic signatures.

## Development

```sh
pnpm --filter @namera-ai/wallet-provider-gcp test
pnpm --filter @namera-ai/wallet-provider-gcp typecheck
pnpm --filter @namera-ai/wallet-provider-gcp build
```

Tests substitute the Google transport; they do not call KMS.
See [account custody](../../../architecture/wallet-system/accounts.md).
