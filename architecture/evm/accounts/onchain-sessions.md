# Onchain session compilation

`packages/evm/src/sessions` compiles Modular Account V2 validation installation
and removal. It uses `@alchemy/smart-accounts` PermissionBuilder, not hosted
Wallet API state. A Sepolia probe of `wallet_createSession` for Namera's fresh
counterfactual WebAuthn factory account was rejected as an undelegated 7702
account. Direct installation has been exercised through the deployed contracts
on a local Sepolia fork instead of assuming compatibility with that API.

This compiler is currently an internal primitive. Per-chain installation storage
and conditional lifecycle transitions exist in the database repository. A
separate session operation ledger retains owner-prepared attempts and signatures
for retry/recovery without overwriting installation history. Owner
approval routes, dashboard and SDK session execution are not wired yet.

## Contract

`EvmSessionAuthorization` is version 1: signer address, non-root entity ID,
finite `validAfter`/`validUntil` Unix seconds and typed onchain permissions.
Amounts are decimal strings on the wire and bigint base units internally.
Selectors are exactly four bytes. Entity IDs 1 through 2,147,483,646 avoid root
entity zero and the upstream offset namespace for hook storage.

| Permission                   | Contract meaning                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `native-token-transfer`      | Cumulative native value ceiling enforced by a pre-execution hook; pair with a target/function grant.                                       |
| `erc20-token-transfer`       | Token transfer/approval spend hook and implicit access to `transfer`/`approve` on that token.                                              |
| `gas-limit`                  | Native-token gas expenditure limit, not a USD budget or number of transactions; implemented by the SDK's NativeTokenLimit validation hook. |
| `contract-access`            | Calls to a particular non-account target, without a selector restriction.                                                                  |
| `account-functions`          | Direct account selectors; SDK rejects privileged management and manually supplied execute selectors.                                       |
| `functions-on-all-contracts` | Listed selectors on any target.                                                                                                            |
| `functions-on-contract`      | Listed selectors on one target.                                                                                                            |
| `root`                       | Global account authority. Must be the sole permission and requires explicit high-risk owner disclosure in UI.                              |

Target/function permissions are additive grants, not intersecting restrictions.
Native and token spend hooks constrain executions. Do not describe two target
grants as two allowlists which must both match. Repeated targets, including
token-grant/contract-grant overlap, are rejected case-insensitively because
upstream storage can make their meaning order-dependent. Restricted grants may
not target the wallet itself or its control modules. Wildcard selectors may not
invoke module configuration functions. Such access can let a key rewrite its
own restrictions and is reserved for explicit root authority. Native and gas limits
are cumulative; API rolling/calendar budgets remain distinct policy instances.

The compiler attaches TimeRangeModule explicitly. PermissionBuilder's
`deadline` only attaches a hook when compiling a deferred action, not when
calling `compileRaw`. Sessions therefore cannot omit onchain lifetime checks.
It compiles once because the upstream builder appends hooks while compiling.
Removal uses each hook's original initialization data: allowlists need their
target/selector tuples to clear storage, while native/time hooks decode the
leading entity ID, including offset IDs. Removal orders validation hooks before
execution hooks, reversing insertion order within each contract linked list.
Passing only an entity ID to an
allowlist can detach the hook while leaving its permission storage behind.

The installed validation enables UserOperations, not ERC-1271 signature
validation. Signature capability needs its own explicit implementation and
tests; transaction access must never silently grant arbitrary signatures.
Alchemy's TimeRangeModule deliberately does not enforce time bounds for
ERC-1271 signatures, and its spend/allowlist hooks do not restrict message
contents. Those restrictions must not be advertised as onchain signature rules.
See the upstream [TimeRangeModule](https://github.com/alchemyplatform/modular-account/blob/develop/src/modules/permissions/TimeRangeModule.sol)
and [ModuleManagerInternals](https://github.com/alchemyplatform/modular-account/blob/develop/src/account/ModuleManagerInternals.sol).

## Verification

Opt-in tests under `packages/evm/tests/integration/aa` use an explicitly configured local
Anvil endpoint and verify its client identity before funding ephemeral test
keys. They execute EntryPoint 0.7 `handleOps` against forked Alchemy contracts.
They do not mock validation or run transactions on the source chain.

Coverage includes P-256 deployment with high-S authenticator output, session
installation, native allowance, target denial, start/expiry enforcement and
revocation. This lane does not verify hosted bundling or BSO sponsorship.
Installation and removal are also exercised as self-targeted calls through the
root account's normal `encodeCalls` path. The owner-approval workflow can use
normal execution preparation instead of a separate gas-estimation pipeline.

## Pending

- Connect persisted per-chain installation state to owner approval and receipt recovery.
- Bind owner approvals to exact installation/removal operations.
- Add real-contract tests for all permission types and signature capability.
- Wire application, routes, browser approval and local session signing.
- Verify hosted bundler/BSO support on the eight advertised chains.
