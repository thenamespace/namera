# Session policies and templates

Transaction restrictions are installed in the smart account. API policies govern
delegated message and typed-data signatures. Billing limits are independent of
both: a spending permission does not grant sponsorship.

## Onchain permissions

Each chain installation binds its signer, validator entity, validity window and
permission set. The compiler translates protocol definitions to Alchemy Modular
Account permissions.

| Permission                   | Authority                                                       |
| ---------------------------- | --------------------------------------------------------------- |
| `root`                       | Unrestricted account authority, including permission management |
| `native-token-transfer`      | Native-token allowance                                          |
| `erc20-token-transfer`       | Token-specific allowance                                        |
| `gas-limit`                  | Gas limit                                                       |
| `contract-access`            | Calls to a specific contract                                    |
| `functions-on-contract`      | Selected selectors on a specific contract                       |
| `functions-on-all-contracts` | Selected selectors across contracts                             |
| `account-functions`          | Selected account selectors                                      |

The permission safety validator rejects unsupported or unsafe combinations before
installation. Simulation and signed-envelope checks bind execution to the stored
configuration; callers do not supply a replacement permission set at execution.
Installed permissions are the onchain enforcement boundary, including against a
caller who bypasses Namera's API.

## API signature policies

| Policy                | Role                                                  |
| --------------------- | ----------------------------------------------------- |
| `evm.signature`       | Explicitly grants matching message/typed-data signing |
| `evm.time-window`     | Restricts when signing is allowed                     |
| `evm.chain-allowlist` | Restricts signing chains                              |

Each type is a singleton in a session configuration. All configured restrictions
must allow the request; time or chain policy alone cannot grant signing. The
registry evaluates in a stable priority order. No API transaction spending or
gas counter duplicates the installed onchain permissions.

## Templates

`packages/recipes` supplies browser-safe templates, displayed as Templates in the
dashboard. A definition contains display metadata, an Effect input schema,
declarative fields, defaults and a deterministic builder. The dashboard supplies
the account and signer and submits the ordinary session creation request.

The USDC allowance template creates a lifetime allowance per selected network
using native Circle USDC deployments. Each network receives the full allowance;
there is no cross-chain pool or periodic reset. Signatures are disabled. The
generated immutable authorization is persisted, not a recipe version reference.

The ENSv2 renewal template selects Ethereum mainnet and/or Sepolia, payment
tokens and an expiry. It grants only the registrar's `renew` selector plus
`approve` on selected USDC/DAI deployments. Sepolia uses ENS mock tokens, not
Circle test USDC. A zero native-token allowance blocks attached ETH, and
signature authority is disabled. It does not grant batch renewal or registration.
Approval spender and amount, renewal label and duration are not constrained.
Approvals survive session expiry; there is no session spending budget. The
dashboard uses the normal owner installation approval flow to review permissions.
Template tests verify exact deployments/selectors, token subsets, expiry and
rejection of unsupported networks/tokens.

The ENSv2 registration template shares renewal's payment-token configuration but
grants `commit(bytes32)` and
`register(string,address,bytes32,address,address,uint64,address,bytes32)` instead
of `renew`. Names, owners, resolvers, subregistries and registration durations
are supplied at execution; selector permissions do not constrain them. Agents
coordinate commit/reveal and its secret; no registration worker was added.
Registration version 2 adds a checkbox, enabled by default, for
`deployProxy(address,uint256,bytes)` on each selected network's reviewed
VerifiableFactory. Disabling it omits that permission. Implementation, salt and
initializer data are not constrained; the permission allows arbitrary factory
proxy deployments, including Permissioned Resolvers. It adds no authority for
subsequent calls on deployed proxies. Native value remains zero and signatures
remain disabled. Renewal and subname-issuer permissions are unchanged.

The ENSv2 subname issuer selects one Ethereum mainnet or Sepolia network and a
permissioned registry address. It grants only that registry's
`register(string,address,address,address,uint256,uint64)` selector, with zero
native value and signatures disabled. There are no token approvals or new
policies. Registration arguments, including child owners, roles and name expiry,
remain unrestricted. Creating a session does not grant ENS registrar authority.
Dashboard preflight uses the existing RPC proxy and EVM identity-review entry to
check deployed code, `IPermissionedRegistry` support and the selected account's
root registrar role at a single block. It blocks creation on a failed check or
RPC error and rechecks on each submission. These reads create no state or audit
event; the normal session creation and installation workflow owns persistence,
audit and owner approval. ENS enforces its current roles at execution. Tests
cover exact scope, invalid addresses/networks, role denials and RPC recovery.

The Uniswap v3 swaps template grants only SwapRouter02 selectors `0x04e45aaf`
(`exactInputSingle`) and `0xb858183f` (`exactInput`) on its eight reviewed Ethereum,
Base, Arbitrum and Optimism mainnet/Sepolia deployments. A zero native-value
allowance and disabled signatures keep the template to ERC20 swaps. There are no
approval permissions, multicall, native wrapping or exact-output functions.
Input-token allowances must be established separately by the owner or another
authorized key. Existing allowances can make any approved token spendable;
recipient, output token, route, amounts and slippage are not constrained. Router02
tuples omit the original router's deadline field; session validity still applies.
The browser offers networks and expiry plus a single approval prerequisite line.
It does not check allowances or execute swaps.
The existing session creation/owner approval flow owns persistence and audit;
there is no new backend workflow or audit event. Unit/browser tests verify exact
deployments/selectors, no approvals, expiry, validation and selection retention.

The Uniswap v3 liquidity template enables selected NonfungiblePositionManager
selectors: `mint` (`0x88316456`), `increaseLiquidity` (`0x219f5d17`),
`decreaseLiquidity` (`0x0c49ccbe`) and `collect` (`0xfc6f7865`). It defaults to
collection only and rejects an empty operation selection. The eight reviewed
network deployments share metadata with the swaps template; OP Sepolia uses
the SDK-Core position manager at `0xda75cef1c93078e8b736fca5d5a30adb97c8957d`.
Native value and signatures are disabled. No token approvals, NFT transfers,
multicall or pool creation are granted. The owner establishes token allowances
separately. Position IDs, recipients, token amounts, pools, ticks and slippage
arguments are unrestricted; Uniswap enforces position authority where required.
The browser shows an approval prerequisite only when creating positions or adding
liquidity is enabled. This is another deterministic session builder using the
existing creation, persistence, audit and owner-installation flow, with no new
backend workflow. Unit tests cover exact selector subsets, all deployments,
collect-only defaults and invalid configuration. Browser tests cover tooltip
access, conditional notes, empty-operation validation and retained edits.

## Code

- [Permission mapping](../../packages/evm/src/sessions/permissions.ts)
- [Permission safety](../../packages/evm/src/sessions/permission-safety.ts)
- [Signature registry](../../packages/evm/src/policy/registry.ts)
- [Signature decisions](../../packages/evm/src/policy/service.ts)
- [Templates](../../packages/recipes/src/index.ts)
