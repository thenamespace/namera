### --to

- **Type:** `0x`-prefixed Ethereum address
- **Required:** for non-interactive input flags

The recipient for a native-token transfer, or the contract receiving calldata.
Use a full 20-byte address. The session key must permit this target.

### --value

- **Type:** non-negative integer string, in wei
- **Required:** for non-interactive input flags

The native-token amount attached to the call. `1000000000000000` means 0.001 ETH.
Use `0` for a contract call that transfers no ETH. Decimal ETH amounts such as
`0.001` are not accepted.

### --data

- **Type:** even-length `0x`-prefixed hex
- **Required:** for non-interactive input flags

ABI-encoded calldata for the target contract. Use `0x` for a plain ETH transfer.
For token transfers, the token amount belongs in calldata, not `--value`.
