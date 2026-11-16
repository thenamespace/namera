# Namera contracts

Foundry project for Namera's on-chain contracts. Contracts are immutable and deployed with CREATE2
through the Arachnid deterministic deployer, so each one has the same address on every chain.

## Setup

Requires Foundry 1.9, plus Slither and Halmos for analysis.

```sh
pnpm install          # also runs `forge soldeer install`
cp .env.example .env  # deployer keystore name, Etherscan key, optional RPC overrides
```

## Commands

| Command              | What it does                                                     |
| -------------------- | ---------------------------------------------------------------- |
| `pnpm build`         | `forge build`                                                    |
| `pnpm test`          | `forge test` (`FOUNDRY_PROFILE=ci` or `deep` for longer fuzzing) |
| `pnpm lint`          | `forge fmt --check` and `forge lint`                             |
| `pnpm analyze`       | Slither                                                          |
| `pnpm symbolic`      | Halmos proofs (`check_*` functions in `test/symbolic/`)          |
| `pnpm coverage`      | Coverage summary and `lcov.info`                                 |
| `pnpm snapshot`      | Gas snapshot                                                     |
| `pnpm chains:status` | Pre-flight and deployment state per chain (read-only)            |
| `pnpm chains:deploy` | Deploy missing contracts, write the manifest, verify             |
| `pnpm chains:verify` | Verify contracts from the manifest on Sourcify and Etherscan     |

`chains:*` take `--chain <slug>` (repeatable), `--network mainnet|testnet` or `--all`. Status defaults
to every chain.

## Layout

```
src/            contracts
test/unit/      unit and fuzz tests
test/symbolic/  Halmos proofs
script/         Deploy.s.sol, Status.s.sol, run.ts (multi-chain runner)
script/config/  Contracts.sol: every managed contract with its versioned label (salt)
chains/         chains.json: supported chains, RPCs and verifiers
deployments/    <chainId>.json manifests written by deploys (committed)
```

## Deterministic deployment

- The address of a contract is `CREATE2(factory, keccak256(label), keccak256(initcode))`. Compiler
  settings in `foundry.toml` are part of the initcode, so they live only in `[profile.default]` and
  must not change after the first deployment. Metadata hashes are disabled for reproducible bytecode.
- A new contract version gets a new label (`namera.<name>.v<n>`) and therefore a new address. Never
  reuse a label for changed code.
- `Deploy.s.sol` runs a pre-flight first (factory present, EntryPoint v0.7 present, Cancun opcodes
  checked on the real node via `eth_call`) and skips contracts that are already deployed, so re-running
  is safe.

### Adding a chain

1. Add it to `chains/chains.json` (id, slug, RPC env name, public RPC, verifiers).
2. `pnpm chains:status --chain <slug>` must report `ready true`.
3. `pnpm chains:deploy --chain <slug>` deploys every contract and verifies it.
4. Commit the new `deployments/<chainId>.json`.

The deployer can be any funded keystore (`cast wallet import`); it does not affect addresses.
