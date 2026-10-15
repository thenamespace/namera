# @namera-ai/evm

Private EVM adapter for smart accounts, transactions, signatures, session
permissions, ENS resolution and portfolio data. The root `Evm` Effect service
contains chain behavior; application owns authorization, custody and persistence.

## Entry points

| Import                            | Use                                                         |
| --------------------------------- | ----------------------------------------------------------- |
| `@namera-ai/evm`                  | Backend service, account/signature adapters and test layers |
| `@namera-ai/evm/chains`           | Browser-safe chain metadata                                 |
| `@namera-ai/evm/session-review`   | Independent installation/removal review                     |
| `@namera-ai/evm/identity-review`  | Primary-name call and envelope review                       |
| `@namera-ai/evm/signature-review` | Owner-signature challenge review                            |

Browser entry points do not load provider credentials or the backend layer.
Exports support the workspace `namera-source` condition and built ESM.

## Responsibilities

- `accounts/` reconstructs version-pinned Alchemy Modular Account V2 accounts
  from public metadata. Signing callbacks are supplied by the caller.
- `execution/` estimates, validates, signs and submits EntryPoint 0.7
  UserOperations, then normalizes receipts and status lookups.
- `sessions/` compiles installed permissions and verifies session signatures.
- `signing/` implements owner/session message and typed-data signatures and
  ERC-1271/ERC-6492 verification.
- `policy/` evaluates delegated signature rules.
- `billing/` estimates gas reservations and queries confirmed BSO charges.
- `identity/` resolves ENS and builds reverse-registrar calls.
- `portfolio/` reads Alchemy assets and prices.

The chain registry includes Ethereum, Base, Arbitrum and Optimism mainnets and
Sepolia testnets. New operation admission respects each chain's enabled flag;
receipt recovery retains access to paused chains.

## Configuration

| Variable                    | Purpose                                         |
| --------------------------- | ----------------------------------------------- |
| `EVM_ALCHEMY_API_KEY`       | RPC, bundler and portfolio access               |
| `EVM_ALCHEMY_BSO_POLICY_ID` | Sponsored bundler policy header                 |
| `ALCHEMY_ACCESS_TOKEN`      | Management API access for confirmed BSO charges |

The access token is required for charge recovery, not startup. Missing charge
data leaves the gas hold pending. Keep credentials server-side.

## Development

```sh
pnpm --filter @namera-ai/evm test
pnpm --filter @namera-ai/evm typecheck
pnpm --filter @namera-ai/evm build
```

`Evm.testLayer` supplies deterministic boundary-test behavior. Contract tests use
an explicitly configured loopback Anvil Sepolia fork:

```sh
NAMERA_TEST_ANVIL_URL=http://127.0.0.1:18545 pnpm --filter @namera-ai/evm test tests/integration/aa
```

Those tests validate local contract behavior, not hosted Alchemy sponsorship.
See [accounts](../../architecture/wallet-system/accounts.md),
[transactions](../../architecture/wallet-system/transactions.md),
[signatures](../../architecture/wallet-system/signatures.md) and
[reconciliation](../../architecture/wallet-system/reconciliation.md).
