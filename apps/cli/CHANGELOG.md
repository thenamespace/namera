# @namera-ai/cli

## 0.1.3

### Patch Changes

- [#8](https://github.com/thenamespace/namera/pull/8) [`63b1616`](https://github.com/thenamespace/namera/commit/63b1616aa059253f9ad914c66a3b065e6e61c85d) Thanks [@envoy1084](https://github.com/envoy1084)! - Print `HelpDoc` on root commands of command groups. This includes:

  ```bash
  namera
  namera keystore/k
  namera smart-account/sa
  namera session-key/sk
  namera mcp
  ```

- [#7](https://github.com/thenamespace/namera/pull/7) [`6ddc54f`](https://github.com/thenamespace/namera/commit/6ddc54f0f6a9452a84f5816d02983b0c8a740ec7) Thanks [@envoy1084](https://github.com/envoy1084)! - Fix `--quite` flag typo throughout all commands

## 0.1.2

### Patch Changes

- [`0644fc0`](https://github.com/thenamespace/namera/commit/0644fc0af2b33640f9ab336b27af148dd47950fc) Thanks [@envoy1084](https://github.com/envoy1084)! - Add `tslib` as a dependency, for `@zerodev/webauth-key` to work

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
