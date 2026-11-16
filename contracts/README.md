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

| Command                  | What it does                                                      |
| ------------------------ | ----------------------------------------------------------------- |
| `pnpm build`             | `forge build`                                                     |
| `pnpm test`              | `forge test` (`FOUNDRY_PROFILE=ci` or `deep` for longer fuzzing)  |
| `pnpm lint`              | `forge fmt --check` and `forge lint`                              |
| `pnpm analyze`           | Slither                                                           |
| `pnpm symbolic`          | Halmos proofs (`check_*` in `*Symbolic*` contracts)               |
| `pnpm coverage`          | Coverage of `src/` (summary and `lcov.info`)                      |
| `pnpm coverage:html`     | Coverage report in `coverage/` (needs `lcov`)                     |
| `pnpm mutation`          | Forge mutation testing over `src/` (slow; `mutation-report.json`) |
| `pnpm snapshot`          | Gas snapshot                                                      |
| `pnpm fixtures:accounts` | Refresh deployed account bytecode in `test/fixtures/accounts/`    |
| `pnpm chains:status`     | Pre-flight and deployment state per chain (read-only)             |
| `pnpm chains:deploy`     | Deploy missing contracts, write the manifest, verify              |
| `pnpm chains:verify`     | Verify contracts from the manifest on Sourcify and Etherscan      |

`chains:*` take `--chain <slug>` (repeatable), `--network mainnet|testnet` or `--all`. Status defaults
to every chain.

## Layout

```
src/                    contracts
script/                 Deploy.s.sol, Status.s.sol, run.ts (multi-chain runner), fixture fetcher
script/config/          Contracts.sol: every managed contract with its versioned label (salt)
chains/                 chains.json: supported chains, RPCs and verifiers
deployments/            <chainId>.json manifests written by deploys (committed)
test/utils/             shared setup: EntryPoint and account fixtures, session builder, test base, mocks
test/unit/              library and validator tests, with fuzzing
test/integration/       SmartSession behaviour through a mock ERC-7579 account and the EntryPoint
test/accounts/          the same session flows on real Kernel 3.3, Nexus 1.3.3 and Safe7579 v2
test/invariant/         stateful fuzzing (handlers in invariant/handlers)
test/symbolic/          Halmos proofs
test/fixtures/          deployed bytecode of the account contracts, one `<name>@<address>.hex` per contract
```

## Tests

All tests run locally without an RPC. EntryPoint v0.7 is compiled from eth-infinitism/account-abstraction
v0.7.0 (test-only dependency, with OpenZeppelin 5.0.2) and deployed at its canonical address. The real
account contracts (Kernel, Nexus, Safe + Safe7579 and their validators and factories) are loaded from
deployed bytecode in `test/fixtures/accounts/` at their canonical addresses, so account tests
exercise exactly what is deployed on chain. Each account test only supplies how to deploy the account, its nonce key layout and its owner
ERC-1271 signature format; `test/accounts/RealAccountTestBase.sol` holds the shared session flows.

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
