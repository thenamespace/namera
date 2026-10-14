# @namera-ai/ens

Private Effect adapter for Namespace offchain names and records. `Ens` wraps
the provider API and translates failures into typed errors. Account authorization,
identity ownership and audit events belong to application.

## Service

`Ens.layer` provides subname creation, availability and lookup, plus address,
text and data-record management. It uses Namespace mainnet and reads the redacted
`NAMERA_ENS_API_KEY` configuration value. Individual calls never accept an API key.

The package exports provider request/response types, `ChainName`, coin-type and
address-validation helpers. A missing single-name lookup returns `null`; other
provider failures remain errors.

`EnsTestLayer` provides owner-filtered in-memory names and records with injectable
write failures. Adapter tests exercise the SDK against a local HTTP fixture.

## Development

```sh
pnpm --filter @namera-ai/ens test
pnpm --filter @namera-ai/ens typecheck
pnpm --filter @namera-ai/ens build
```

See [identities](../../architecture/wallet-system/identity.md) for account
ownership checks, partial updates, primary names and browser uploads.
