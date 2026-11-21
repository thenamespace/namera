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

Deployment runs from the repository root through `namera-dev contracts` (Effect, `tools/cli`):

| Command (repository root) | What it does                                                          |
| ------------------------- | --------------------------------------------------------------------- |
| `pnpm contracts:status`   | Pre-flight and deployment state per chain (read-only)                 |
| `pnpm contracts:deploy`   | Deploy missing contracts, record their provenance, verify them        |
| `pnpm contracts:record`   | Rewrite `deployments/<chainId>.json` from the chain and the broadcast |
| `pnpm contracts:verify`   | Verify recorded contracts on Sourcify and Etherscan                   |
| `pnpm contracts:generate` | Generate `@namera-ai/contracts` from the build and the records        |

The chain commands take `--chain <slug>` (repeatable), `--network mainnet|testnet` or `--all`, and
`--rpc-url <url>` to override the endpoint of a single chain. Status defaults to every chain.
Configuration comes from the environment, then `contracts/.env`.

## Layout

```
src/                    contracts
script/                 Deploy.s.sol, Status.s.sol, fixture fetcher
script/config/          contracts.json: every managed contract with its versioned label (salt), read by Contracts.sol
chains/                 chains.json: supported chains, RPCs and verifiers
deployments/            <chainId>.json provenance records written by `namera-dev contracts record` (committed)
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

Managed contracts (`script/config/contracts.json`, the single list Solidity and the tooling read):

| Label                               | Contract                                         |
| ----------------------------------- | ------------------------------------------------ |
| `namera.smart-session.v1`           | `SmartSession` (ERC-7579 validator)              |
| `namera.ecdsa-session-validator.v1` | `ECDSASessionValidator` (k-of-n session signers) |

`pnpm contracts:status` prints each contract's address. To simulate a deploy without sending transactions:
`forge script script/Deploy.s.sol --rpc-url <url>`.

## Deployment records

`namera-dev contracts deploy` broadcasts `Deploy.s.sol`, then writes `deployments/<chainId>.json`
with one record per contract:

| Field                                 | Source                                                                |
| ------------------------------------- | --------------------------------------------------------------------- |
| `address`, `factory`, `salt`          | CREATE2 inputs; the address is recomputed from the current build      |
| `initcodeHash`                        | `keccak256` of the artifact's initcode, checked against the broadcast |
| `runtimeCodeHash`                     | `keccak256` of the code read from the chain                           |
| `transaction` (hash, block, deployer) | The broadcast run, confirmed against the node's receipt               |
| `source` (commit, compiler settings)  | `git rev-parse HEAD` and the artifact's compiler metadata             |

Deploying refuses to run while `src/`, `script/` or the Foundry config have uncommitted changes, so
the recorded commit is the source that was built. Committed records are kept as long as the chain
still matches them; a record whose code is gone, changed or at another address fails the command.
`transaction` is absent when the code was already on chain before this pipeline ran there (anyone
can deploy the same initcode through the factory).

Keep every deployed label in `contracts.json`: removing one drops it from the generated package.

### Adding a chain

1. Add it to `chains/chains.json` (id, slug, RPC env name, public RPC, verifiers).
2. `pnpm contracts:status --chain <slug>` must report `ready true`.
3. `pnpm contracts:deploy --chain <slug>` deploys every contract, records it and verifies it.
4. `pnpm contracts:generate`, add a changeset for `@namera-ai/contracts`, and commit the new
   `deployments/<chainId>.json` with the generated sources.

The deployer can be any funded keystore (`cast wallet import`); it does not affect addresses.
