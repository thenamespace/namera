# Accounts and smart wallets

The dashboard calls a wallet an **account**. The backend and public contracts use
wallet terminology. A wallet combines organization-owned metadata, a
namespace-specific smart-account address, and one provider-managed owner key.

## Persistence and adapter references

The canonical per-column definitions, keys, foreign keys, checks, and indexes
for `core.wallet_key` and `core.wallet` are in the
[core database catalog](../database/core-wallets-operations.md). Public EVM
responses expose address and Modular Account V2 reconstruction data; provider key
locators remain private. Smart-account versions, reconstruction, and
counterfactual behavior are documented in [EVM accounts](../evm/accounts/README.md).

## Creation

```mermaid
sequenceDiagram
  actor Admin
  participant App as Application.wallet.create
  participant Billing
  participant Keys as WalletKeys
  participant EVM
  participant Tx as PostgreSQL transaction

  Admin->>App: namespace + protection + metadata
  App->>Billing: cheap capacity precheck
  App->>Keys: create provider key
  Keys-->>App: public material + opaque provider data
  App->>EVM: construct Alchemy Modular Account V2
  EVM-->>App: verified smart-account address and data
  App->>Tx: lock billing account and recheck capacity
  App->>Tx: persist wallet key + wallet + audit + notifications + email jobs
  Tx-->>Admin: public wallet DTO
```

Remote key and account creation happens before the transaction. The second
locked billing check prevents concurrent requests from exceeding plan capacity.
EntryPoint version, implementation version, entity ID, salt, and P-256 signing
policy are server-owned constants rather than public input.

## EVM implementations

- Alchemy Modular Account V2 uses EntryPoint 0.7 and the WebAuthn P-256 validation module.
- Account creation and reconstruction share the same constructors.
- Reconstruction derives the smart-account address and rejects persisted data
  when it does not match the stored address.
- Owner signatures use provider-neutral key operations and adapter-owned EVM
  formatting.

See [supported EVM chains](../evm/supported-chains.md) for registry/provider
requirements and [wallet-key providers](wallet-keys.md) for custody boundaries.

## Reads and updates

User actors list/get wallets in the active organization with `wallet:read`.
Machine actors see only wallets reachable through active grants to active
session keys. Metadata updates require `wallet:update`; same-value replacements
are no-ops without duplicate audit, notification, or metrics.

Routes are `POST /wallets`, `GET /wallets`, `GET /wallets/:walletId`,
`GET /wallets/:walletId/assets`, and `POST /wallets/:walletId/update`. The
asset route returns paginated native/ERC-20 holdings across every supported
chain; see [fungible wallet portfolio](../evm/portfolio.md).

## Pending

- Add compensation/reconciliation for an external provider key created before a
  failed account-construction or persistence boundary.
- Define freeze/archive semantics before adding those lifecycle operations.
- Add another namespace only through a new discriminated chain adapter rather
  than EVM conditionals in application workflows.
