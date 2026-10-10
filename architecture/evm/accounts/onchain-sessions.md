# Onchain session compilation

`packages/evm/src/sessions` compiles Modular Account V2 validation installation
and removal. It uses `@alchemy/smart-accounts` PermissionBuilder, not hosted
Wallet API state. A Sepolia probe of `wallet_createSession` for Namera's fresh
counterfactual WebAuthn factory account was rejected as an undelegated 7702
account. Direct installation has been exercised through the deployed contracts
on a local Sepolia fork instead of assuming compatibility with that API.

The compiler is exposed through `evm.sessions.compile`. It reconstructs and
checks the stored account on the selected chain without invoking its owner
signer, then maps the compiler output to `EvmSessionInstallationData`.
`evm.sessions.prepareOperation` prepares a single zero-value self-call using
that stored installation/removal calldata through the normal execution pipeline.
Only scoped persisted compiler output may enter this method; public requests
must not supply arbitrary owner calls or replacement installation data.

Per-chain installation storage
and conditional lifecycle transitions exist in the database repository. A
separate session operation ledger retains owner-prepared attempts and signatures
for retry/recovery without overwriting installation history. Owner approval and
receipt recovery are wired in the API; SDK local execution is implemented.
Dashboard passkey approval, encrypted export and detached local message signing
are wired through the SDK and local CLI MCP.

## Contract

`EvmSessionAuthorization` is version 1: signer address, non-root entity ID,
finite `validAfter`/`validUntil` Unix seconds and typed onchain permissions.
Optional `allowSignatures` defaults to false. It is a separate owner-approved
capability, never inferred from an API signature policy or a root execution grant.
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

The installed validation always enables UserOperations. Only explicit
`allowSignatures: true` additionally enables ERC-1271 validation. After compiling
hooks once, the adapter encodes the final installation arguments with this flag;
PermissionBuilder alone always leaves it false. The flag is persisted in each
chain authorization and bound into its owner-approved installation hash.
Alchemy's TimeRangeModule deliberately does not enforce time bounds for
ERC-1271 signatures, and its spend/allowlist hooks do not restrict message
contents. Those restrictions must not be advertised as onchain signature rules.
Expiry or API revocation stops requests through Namera but cannot prevent the
local key holder from signing independently. Uninstalling the validation removes
its ERC-1271 authority, including acceptance of previously issued signatures.
The dashboard must disclose this before allowing signature authority. This
compiler support alone does not implement the detached signature API.
See the upstream [TimeRangeModule](https://github.com/alchemyplatform/modular-account/blob/develop/src/modules/permissions/TimeRangeModule.sol)
and [ModuleManagerInternals](https://github.com/alchemyplatform/modular-account/blob/develop/src/account/ModuleManagerInternals.sol).

## Verification

`reviewEvmSessionOperation` exposes read-only public-passkey reconstruction and
the existing permission compiler for browser approval review. Its output contains
the expected self-call, factory arguments, owner entity and account/chain. The
caller supplies a trusted chain-aware RPC; a chain mismatch or reconstructed
address mismatch fails closed. No owner signing callback is supplied. Unit tests
run real account construction and encoding with substituted RPC reads, including
signature-consent changes and installation/removal differences.
Factory arguments are derived from the public passkey, salt and owner entity,
independent of deployment status. Viem's `getFactoryArgs` omits them for deployed
wallets; using it for review would block subsequent installation and removal.
Unit coverage includes deployed and counterfactual accounts. A live Sepolia
browser approval also confirmed a second installation on an already deployed
wallet; the local MCP execution journey is recorded in the client architecture.

Opt-in tests under `packages/evm/tests/integration/aa` use an explicitly configured local
Anvil endpoint and verify its client identity before funding ephemeral test
keys. They execute EntryPoint 0.7 `handleOps` against forked Alchemy contracts.
They do not mock validation or run transactions on the source chain.

Coverage includes P-256 deployment with high-S authenticator output, session
installation, native allowance, target/selector denial, ERC-20 transfer/approval
allowance exhaustion, start/expiry enforcement and
revocation. The adapter compilation path also rejects mismatched reconstructed
addresses and unsafe account-target grants. It uses a public-key-only owner.
This lane does not verify hosted bundling or BSO sponsorship.
The factory ECDSA suite additionally installs a restricted local session on a
normal SemiModularAccountBytecode account, executes an allowed transfer, rejects
another target and verifies removal. Compilation uses public-only owner material;
owner operations use an application-style recoverable digest-signing callback.
Managed-owner application approval is wired through explicit 1Claw prepare/approve
API endpoints and the existing receipt worker; see
[session keys](../../wallets/session-keys.md). Managed-session custody and
dashboard managed-owner approval remain separate work. Server boundary tests
exercise real test-provider signatures with substituted chain submission; live
1Claw/bundler verification remains outstanding.
The token tests deploy the checked-in test token and assert both UserOperation
outcomes and token balances/allowances. They exercise Namera's compilation through
the deployed permission modules, not a substitute policy evaluator.
Installation and removal are also exercised as self-targeted calls through the
root account's normal `encodeCalls` path. The owner-approval workflow can use
normal execution preparation instead of a separate gas-estimation pipeline.
`session-signatures.test.ts` verifies default-denied signature authority, opt-in
message and typed-data signatures, wrong-message/chain/wallet replay rejection,
continued signature validity after TimeRange expiry and rejection after uninstall
against the actual forked contracts.
