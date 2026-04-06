# @namera-ai/cli

## 0.1.1

### Patch Changes

- [`aa767ef`](https://github.com/thenamespace/namera/commit/aa767ef1d86c38e07b2e75ae4aa7ff1be4ea8d4d) Thanks [@envoy1084](https://github.com/envoy1084)! - Fix broken npm install caused by `workspace:*` dependencies being published.

## 0.1.0

### Minor Changes

- [`8ad33c8`](https://github.com/thenamespace/namera/commit/8ad33c835c0c49a90c8553919d8225d8a790bc1b) Thanks [@envoy1084](https://github.com/envoy1084)! - Initial release of `@namera-ai/cli`

  A local-first, agent-first CLI for managing smart accounts with session keys and scoped permissions across chains.

  This release provides a complete command-line interface for keystores, smart accounts, session keys, and MCP server management, designed for both interactive human use and deterministic agent-driven workflows.

  **Keystore Management**

  - Create encrypted keystores for owner signers
  - Import existing keystores from private keys
  - List, inspect, and decrypt keystore metadata
  - Remove keystores from disk

  **Smart Account Management**

  - Create ECDSA smart accounts linked to owner keystores
  - Import existing smart accounts from serialized data
  - List, inspect, and query account details
  - Check deployment status per chain
  - Remove smart account descriptors from disk

  **Session Key Management**

  - Create session keys with scoped policies (sudo, call, gas, timestamp, rate-limit, signature-caller)
  - List, inspect, and query session key metadata
  - Check installation status per chain
  - Remove session keys from disk

  **MCP Server**

  - Start local MCP server over stdio (default) or HTTP transport
  - Expose wallet tools: `get_wallet_address`, `get_balance`, `read_contract`, `native_transfer`, `execute_transaction`
  - Multi-chain support with per-chain RPC, bundler, and paymaster configuration via environment variables

### Patch Changes

- Updated dependencies [[`7781aea`](https://github.com/thenamespace/namera/commit/7781aea6f0c7441e27d3220bbcef793bd544e82d)]:
  - @namera-ai/sdk@0.1.0
