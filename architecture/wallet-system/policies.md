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

Arc uses the same permission compiler and chain-specific installations. Its native
spending and gas amounts use 18-decimal USDC base units; ERC-20 USDC allowances
use six decimals. Those are separate counters over one balance, not a combined
spending budget. The USDC template grants only the ERC-20 path on Arc. Adding a
supported network never widens an existing installation or signature allowlist.

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

## Code

- [Permission mapping](../../packages/evm/src/sessions/permissions.ts)
- [Permission safety](../../packages/evm/src/sessions/permission-safety.ts)
- [Signature registry](../../packages/evm/src/policy/registry.ts)
- [Signature decisions](../../packages/evm/src/policy/service.ts)
- [Templates](../../packages/recipes/src/index.ts)
