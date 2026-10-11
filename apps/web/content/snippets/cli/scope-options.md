### --namespace

- **Type:** `evm | eip155`
- **Required:** for non-interactive input flags

Select the EVM network family. Both values resolve to the same namespace.
This is not the chain ID; choose the network separately.

### --wallet

- **Type:** `string` (account ID)
- **Required:** for non-interactive input flags

Use an ID from `namera --output json wallet list`, not an Ethereum address.
With input flags, the CLI reads the account to validate your selection.

### --network

- **Type:** network name, numeric chain ID, or CAIP-2 ID
- **Required:** for non-interactive input flags

For Base Sepolia, use `--network 'Base Sepolia'`, `--network 84532`, or
`--network eip155:84532`. Names are case-insensitive. The supported networks are
Ethereum, Sepolia, Base, Base Sepolia, Arbitrum One, Arbitrum Sepolia,
OP Mainnet, and OP Sepolia. [Supported Networks](/docs/sdk/supported-networks)
lists their identifiers.
