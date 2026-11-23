# namera

Scoped, revocable permissions for agent wallets on ERC-7579 smart accounts.

## Packages

| Package                                                  | Description                                                                          |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [`@namera-ai/contracts`](./packages/contracts/README.md) | ABIs and deployment addresses of Namera's Smart Sessions contracts.                  |
| [`@namera-ai/sdk`](./packages/sdk/README.md)             | Scoped, revocable session keys for agents on ERC-7579 smart accounts, built on viem. |

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
