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
src/smart-sessions/     Namera's fork of Smart Sessions (LGPL/AGPL, see its NOTICE.md)
src/validators/         ECDSASessionValidator
src/policies/           Namera's policies (Apache-2.0), one per `Policy.*` builder, and their libraries in lib/
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
test/unit/policies/, test/integration/policies/   policy tests, directly and through SmartSession and the EntryPoint
test/fixtures/          deployed bytecode of the account contracts, one `<name>@<address>.hex` per contract
```

## Tests

All tests run locally without an RPC. EntryPoint v0.7 is compiled from eth-infinitism/account-abstraction
v0.7.0 (test-only dependency, with OpenZeppelin 5.0.2) and deployed at its canonical address. The real
account contracts (Kernel, Nexus, Safe + Safe7579 and their validators and factories) are loaded from
deployed bytecode in `test/fixtures/accounts/` at their canonical addresses, so account tests
exercise exactly what is deployed on chain. Each account test only supplies how to deploy the account, its nonce key layout and its owner
ERC-1271 signature format; `test/accounts/RealAccountTestBase.sol` holds the shared session flows.

## Policies

`src/policies/` holds the launch policies that back the SDK's `Policy.*` builders. Every one is immutable and
admin-free, and serves every account and session from one deployment:

| Contract          | Kind            | Enforces                                                                                                                 |
| ----------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `AllowPolicy`     | action, user op | nothing: the policy for a call allowed without conditions (Smart Sessions needs one per action)                          |
| `ArgPolicy`       | action          | conditions on static argument words and the value: `Eq`, `Neq`, `Lt`, `Lte`, `Gt`, `Gte`, `Between`, `OneOf`             |
| `ApprovalPolicy`  | action          | allowed spenders and a maximum for ERC-20 `approve` / `increaseAllowance` and Permit2 `approve`                          |
| `SpendPolicy`     | user op         | ERC-20 budgets per token and period across every call (transfers, and approvals unless an `ApprovalPolicy` governs them) |
| `ValuePolicy`     | user op         | a native-currency budget per period                                                                                      |
| `RateLimitPolicy` | user op         | operations per period                                                                                                    |
| `GasPolicy`       | user op         | worst-case gas cost per period                                                                                           |
| `SignaturePolicy` | ERC-1271        | which contracts may verify the session's signatures                                                                      |

**Periods without TIMESTAMP.** ERC-7562 bans `TIMESTAMP` during validation. The agent appends the time it sends at
as one 32-byte word after the ABI encoding of the account's `execute` calldata (accounts and Smart Sessions ignore it;
the session signature covers it). A limit charges the period containing that time and returns the period's bounds as
validation data, so the EntryPoint only accepts the operation within that period. Periods are epoch-aligned (a day is
a UTC day); a period of 0 is the lifetime and needs no time. Counters are keyed by schedule, never by budget, so
re-enabling a session never resets them.

**Storage.** Every slot is `keccak256(account ‖ x) + n` (`lib/PolicyStorage.sol`), ERC-7562 associated storage;
configurations are stored as words, so no dynamic storage arrays are needed. `@namera-ai/devnet`'s ERC-7562 test traces
a real session operation's validation and checks both rules on these contracts.

**Signatures.** Smart Sessions gives ERC-1271 policies only the final nested hash, so `SignaturePolicy` cannot check
message fields (a permit's spender or value); Smart Sessions itself limits the app domains and content types a session
may sign.

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
