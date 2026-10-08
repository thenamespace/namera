# Supporting packages

## `packages/utils`

Utils contains deterministic, state-free helpers that do not depend on project Effect services or application state. Examples include unique-ID generation, encoding/canonicalization, and other low-level utilities reused across packages.

Before adding a helper:

- search for an existing utility;
- require at least a real cross-call-site responsibility, not speculative abstraction;
- keep it independent of database/runtime/provider services;
- test edge cases directly;
- export only through the supported package entry point.

One-off domain logic belongs beside its domain operation. Repeated domain logic belongs in a domain helper module, not automatically in global utils.

## `packages/ens`

ENS owns the provider boundary for Namera offchain identities. Its live Effect
layer constructs Namespace's offchain manager with the redacted
`NAMERA_ENS_API_KEY`, while the service exposes subname lifecycle,
queries, and address/text/data record operations as typed Effects. Provider
failures are translated to stable `EnsError` reasons before they leave the
package.

The application exposes name availability reads. Wallet creation does not
assign an ENS name; provider capabilities do not imply a wired account-naming
workflow.

## `packages/passkeys`

Passkeys owns WebAuthn ceremony generation and cryptographic verification.
Application workflows bind challenges to the user, wallet and operation, consume
them transactionally, and persist public credential material. Browser private
keys never enter this service. The server supplies runtime dependencies.

## `packages/template`

Template is the workspace starter for a new package. It owns no product runtime behavior. When creating a package, copy/update its manifest, TypeScript/Klarity/build configuration, source entry, README, tests, and Turborepo integration while preserving the `namera-source` development condition and unbundled source strategy.

## Package entry-point rules

- Internal package imports use `#/*` aliases.
- Cross-package imports use package exports.
- Relative ESM imports include `.js`.
- Root barrels expose supported APIs only; implementation/provider modules remain internal unless another package is intentionally allowed to depend on them.
- A growing flat directory should be grouped by domain with a barrel at the boundary.
