# Transactions

Open the guide for the interface being used:

- Transfer native tokens or ERC-20s: [SDK](https://namera.ai/docs/sdk/guides/transactions/transfer-assets.md) / [CLI](https://namera.ai/docs/cli/guides/transactions/transfer-assets.md).
- Simulate: [SDK](https://namera.ai/docs/sdk/guides/transactions/simulate-transactions.md) / [CLI](https://namera.ai/docs/cli/guides/transactions/simulate-transactions.md).
- Choose sponsored or self-funded gas: [SDK](https://namera.ai/docs/sdk/guides/transactions/sponsor-gas.md) / [CLI](https://namera.ai/docs/cli/guides/transactions/sponsor-gas.md).
- Call a contract: [SDK](https://namera.ai/docs/sdk/guides/transactions/interact-with-contracts.md) / [CLI](https://namera.ai/docs/cli/guides/transactions/interact-with-contracts.md).
- Batch calls: [SDK](https://namera.ai/docs/sdk/guides/transactions/batch-transactions.md) / [CLI](https://namera.ai/docs/cli/guides/transactions/batch-transactions.md).
- Track a submission: [SDK](https://namera.ai/docs/sdk/guides/transactions/track-transactions.md) / [CLI](https://namera.ai/docs/cli/guides/transactions/track-transactions.md).
- Recover an interrupted request: [SDK](https://namera.ai/docs/sdk/guides/transactions/handle-retries-and-recovery.md) / [CLI](https://namera.ai/docs/cli/guides/transactions/handle-retries-and-recovery.md).

## Gas and amounts

Sponsorship pays gas, not the assets being transferred. For self-funded execution,
use the gas guide's explicit ceiling: SDK client configuration, a CLI option, or
the user's MCP server configuration. Choose one funding mode; both examples submit
transactions.

Check [Supported Networks](https://namera.ai/docs/sdk/supported-networks.md) for
chain IDs and native units. Arc uses 18-decimal USDC for native value and gas;
ERC-20 USDC transfers use 6 decimals.

## After submission

Save the returned submission ID and track it to confirmation. Submission is not
confirmation, and simulation does not guarantee execution.

After a lost response, check the known submission before executing again. History
contains confirmed executions only; an empty history does not rule out a pending
submission. If its outcome is unknown, keep it unresolved rather than resending.
