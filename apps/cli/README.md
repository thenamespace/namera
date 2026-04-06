# Namera CLI

Namera CLI gives agents controlled access to smart accounts with session keys and scoped permissions, running fully local and agent-first across chains.

<p>
  <a href="https://www.npmjs.com/package/@namera-ai/cli"><img src="https://img.shields.io/npm/v/@namera-ai/cli" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@namera-ai/cli"><img src="https://img.shields.io/npm/dm/@namera-ai/cli" alt="npm downloads"></a>
  <a href="https://github.com/thenamespace/namera/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@namera-ai/cli" alt="license"></a>
</p>

## Contents

- [Namera CLI](#namera-cli)
  - [Contents](#contents)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Quick Start](#quick-start)
  - [Why Namera CLI?](#why-namera-cli)
  - [Command Groups](#command-groups)
  - [Params Mode and Schema](#params-mode-and-schema)
  - [Output Formats](#output-formats)
  - [Session Key Policies](#session-key-policies)
  - [MCP Server](#mcp-server)
    - [MCP Params Mode](#mcp-params-mode)
  - [Supported Chains](#supported-chains)
  - [Environment Variables](#environment-variables)
  - [Examples](#examples)
  - [Documentation](#documentation)
  - [Security](#security)
  - [License](#license)

## Prerequisites

- **Node.js 18+** for running the CLI via npm/pnpm/bun

## Installation

Install globally with your package manager:

```bash
npm i -g @namera-ai/cli
#or
pnpm i -g @namera-ai/cli
#or
bun i -g @namera-ai/cli
#or
yarn global add @namera-ai/cli
```
Build from source:

```bash
gh repo clone thenamespace/namera
cd namera
bun install
cd apps/cli
bun run build
bun run start -- --help
```

## Quick Start

Create a keystore, smart account, and session key (interactive prompts):

```bash
namera keystore create --alias my-owner
```
```bash
namera smart-account create --alias my-smart --owner-alias my-owner
```
```bash
namera session-key create --alias my-session-key --smart-account my-smart
```

Start the MCP server:

```bash
namera mcp start --smart-account my-smart --session-key my-session-key=my-password --transport http --port 8080
```

## Why Namera CLI?

**For humans**: clear prompts, consistent flags, and readable output.

**For agents**: every command has a JSON schema, supports deterministic `--params`, and returns structured output that is easy to parse.

```bash
# Schema discovery
namera schema session-key.create
```

```bash
# Deterministic params mode
namera session-key create --params '{"alias":"my-session-key","smartAccountAlias":"my-smart","chains":["eth-mainnet"],"sessionKeyPassword":"session-password","ownerKeystorePassword":"owner-password","policyParams":[{"type":"sudo"}]}'
```

## Command Groups

- `keystore` (`k`): Create, import, list, inspect, decrypt, and remove keystores
- `smart-account` (`sa`): Create, import, list, inspect, status, and remove smart accounts
- `session-key` (`sk`): Create, list, inspect, status, and remove session keys
- `schema`: Print JSON schema for command parameters
- `mcp`: Start the local MCP server

Explore help:

```bash
namera --help
namera keystore --help
namera smart-account --help
namera session-key --help
namera mcp --help
```

## Params Mode and Schema

Agents should use `--params` with the schema command to discover the exact input shape.

```bash
namera schema keystore.create
namera schema smart-account.create
namera schema session-key.create
namera schema mcp.start
```

Example params mode calls:

```bash
namera keystore create --params '{"alias":"my-owner","password":"my-password"}'
```

```bash
namera smart-account create --params '{"alias":"my-smart","ownerAlias":"my-owner","ownerPassword":"my-password","index":0}'
```

```bash
namera session-key create --params '{"alias":"my-session-key","smartAccountAlias":"my-smart","chains":["eth-mainnet"],"sessionKeyPassword":"session-password","ownerKeystorePassword":"owner-password","policyParams":[{"type":"sudo"}]}'
```

## Output Formats

All commands support global output flags:

- `--output`, `-o`: `pretty` (default), `json`, or `ndjson`
- `--quite`, `-q`: Suppress output entirely

```bash
namera smart-account list --output json
namera session-key list --output ndjson
```

## Session Key Policies

Session keys are scoped by one or more policies:

- `sudo`: Full permission, no restrictions
- `call`: Restrict targets, functions, and value limits
- `timestamp`: Limit validity by time range
- `gas`: Limit total gas spend and optionally require a paymaster
- `rate-limit`: Limit number of requests per interval
- `signature-caller`: Restrict who can validate signatures

Example policy payload:

```json
{ "type": "timestamp", "validAfter": 1719916800, "validUntil": 1722604800 }
```

## MCP Server

Start MCP over stdio (default):

```bash
namera mcp start --smart-account my-smart --session-key my-session-key=my-password
```

Start MCP over HTTP:

```bash
namera mcp start --smart-account my-smart --session-key my-session-key=my-password --transport http --port 8080
```

HTTP endpoint: `http://localhost:8080/mcp`

Tools exposed:

- `get_wallet_address`
- `get_balance`
- `read_contract`
- `native_transfer`
- `execute_transaction`

### MCP Params Mode

```bash
namera mcp start --params '{"smartAccountAlias":"my-smart","transport":"http","port":8080,"sessionKeys":{"my-session-key":"my-password"}}'
```

## Supported Chains

See the supported chain keys and IDs on [Namera Documentation](https://namera.ai/docs/cli/supported-chains).

## Environment Variables

You can pass chain-specific environment variables when starting MCP:

```bash
# Ethereum Mainnet
export ETH_MAINNET_RPC_URL="https://mainnet.infura.io/v3/YOUR-PROJECT-ID"
export ETH_MAINNET_BUNDLER_URL="https://rpc.zerodev.app/api/v3/<api-token>/chain/1"
export ETH_MAINNET_PAYMASTER_URL="https://rpc.zerodev.app/api/v3/<api-token>/chain/1"

# Polygon Mainnet
export POLYGON_MAINNET_RPC_URL="https://polygon-rpc.com"
export POLYGON_MAINNET_BUNDLER_URL="https://rpc.zerodev.app/api/v3/<api-token>/chain/137"
export POLYGON_MAINNET_PAYMASTER_URL="https://rpc.zerodev.app/api/v3/<api-token>/chain/137"

# ... and more
```

By default, MCP uses the public RPC and public Pimlico Bundler RPC: `https://public.pimlico.io/v2/{chain_id}/rpc`.

## Examples

Create a keystore and smart account:

```bash
# Create a keystore
namera keystore create -a my-owner -p my-password
```

```bash
# Create a smart account
namera smart-account create -a my-smart -oa my-owner -op my-password -i 0
```

Create a session key (interactive policy selection):

```bash
namera session-key create -a my-session-key -sa my-smart
```

Check deployment status:

```bash
# Check smart account deployment status on Ethereum Mainnet
namera smart-account status --alias my-smart --chain eth-mainnet
```

```bash
# Check session key installation status on Ethereum Mainnet
namera session-key status --alias my-session-key --chain eth-mainnet
```

## Documentation

- CLI Docs: [https://namera.ai/docs/cli](https://namera.ai/docs/cli)
- CLI Docs Source: [apps/docs/content/docs/cli](https://github.com/thenamespace/namera/tree/main/apps/docs/content/docs/cli)

## Security

Please report security issues via GitHub: https://github.com/thenamespace/namera/security

## License

Apache 2.0. See [LICENSE](https://github.com/thenamespace/namera/blob/main/LICENSE).
