# namera

Scoped, revocable permissions for agent wallets on Kernel 3.3 smart accounts (EntryPoint v0.7, deployed or through
EIP-7702), on Base, Sepolia, Base Sepolia, Arbitrum Sepolia and OP Sepolia.

> **Unaudited.** Namera v2 is a release candidate (`2.0.0-rc`, npm tag `rc`). Its contracts have had internal security
> reviews only, no external audit, and there is no bug bounty yet. See [SECURITY.md](./SECURITY.md).

## Packages

| Package                                                  | Description                                                                            |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [`@namera-ai/contracts`](./packages/contracts/README.md) | ABIs and deployment addresses of Namera's Smart Sessions contracts.                    |
| [`@namera-ai/sdk`](./packages/sdk/README.md)             | Scoped, revocable session keys for agents on Kernel 3.3 smart accounts, built on viem. |

## Development

Requires Node.js 26 (`.node-version`), pnpm 12 and [Foundry](https://getfoundry.sh) 1.9.

```sh
pnpm install
pnpm check
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the workflow and [SECURITY.md](./SECURITY.md) to
report a vulnerability.

## License

[Apache-2.0](./LICENSE)
