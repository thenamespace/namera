---
"@namera-ai/sdk": major
---

Namera v2: a rewrite on viem and Effect, with no compatibility with 1.x. This is a release candidate, and the
contracts it uses are unaudited (internal security reviews only).

- **One account:** Kernel 3.3 on EntryPoint 0.7, deployed through its factory or on an EOA through EIP-7702. Namera's
  contracts are deployed on Base, Sepolia, Base Sepolia, Arbitrum Sepolia and OP Sepolia.
- **Two mirrored APIs:** the Promise API (`@namera-ai/sdk`) and the Effect API (`@namera-ai/sdk/effect`), with every
  module also importable on its own (`@namera-ai/sdk/Grant`), plus the `./node`, `./browser`, `./decorators` and
  `./otel` entries. `effect` (^4.1.5) and `viem` (^2.58.4) are peers. The SDK depends on the exact `ox` its viem
  uses (0.14.67), so an app bundles one ox: upgrade viem and the SDK together.
- **Errors:** one `Data.TaggedError` class per failure family, with a tagged `reason`: `ChainError`, `AccountError`,
  `SessionError`, `GrantError`, `PolicyViolationError`, `KeystoreError`, `SessionKeyError`, `BundlerError`,
  `PaymasterError`, `CompatError` and `SerializationError`. Each carries viem's error fields, where it happened
  (`ChainError` has `method`, `chainId` and `url`) and a hint, never an endpoint's credentials. Raw viem and ox errors
  become a `ChainError` with the original as the `cause`. `NameraError` holds the union, `isNameraError` (safe across
  duplicate copies of the package) and `decode`.
- `Session.now()` returns the current time in the seconds sessions use; the Effect form reads `Clock`.
