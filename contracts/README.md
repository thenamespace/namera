# Namera contracts

Foundry project for Namera's on-chain contracts. Contracts are immutable and deployed with CREATE2
through the Arachnid deterministic deployer, so each one has the same address on every chain.

**One account: Kernel 3.3 on EntryPoint v0.7**, deployed or through EIP-7702. Smart Sessions and `SessionHook` refuse
to install on any other account (`src/smart-sessions/lib/SupportedAccount.sol`): they depend on Kernel 3.3's
validator-bound hook, its ERC-1271 hash wrapper and the modules it reports, and are tested against its deployed
bytecode only.

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

Deployment runs from the repository root through `node scripts/bin.ts contracts` (the repository's Effect CLI in `scripts/`):

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
src/validators/         ECDSASessionValidator, WebAuthnValidator
src/hooks/              SessionHook, IExecutionPolicy and ExecutionPolicyBase (execution policies)
src/policies/           Namera's policies (Apache-2.0), one per `Policy.*` builder, and their libraries in lib/
script/                 Deploy.s.sol, Status.s.sol, fixture fetcher
script/config/          contracts.json: every managed contract with its versioned label (salt), read by Contracts.sol
chains/                 chains.json: supported chains, RPCs and verifiers
deployments/            <chainId>.json provenance records written by `pnpm contracts:record` (committed)
test/utils/             shared setup: EntryPoint and account fixtures, session builder, test base, mocks
test/unit/              library and validator tests, with fuzzing
test/integration/       SmartSession behaviour through a mock ERC-7579 account and the EntryPoint
test/accounts/          the session flows on real Kernel 3.3 bytecode, with and without SessionHook
test/invariant/         stateful fuzzing (handlers in invariant/handlers)
test/symbolic/          Halmos proofs
test/unit/policies/, test/integration/policies/   policy tests, directly and through SmartSession and the EntryPoint
test/fixtures/          deployed bytecode of the account contracts, one `<name>@<address>.hex` per contract
```

## Tests

All tests run locally without an RPC. EntryPoint v0.7 is compiled from eth-infinitism/account-abstraction
v0.7.0 (test-only dependency, with OpenZeppelin 5.6.1) and deployed at its canonical address. The real
account contracts (Kernel 3.3's factory, implementation, staker and ECDSA validator) are loaded from
deployed bytecode in `test/fixtures/accounts/` at their canonical addresses, so account tests
exercise exactly what is deployed on chain. `test/accounts/RealAccountTestBase.sol` holds the session flows and
`SessionHookFlows.sol` the execution-policy flows; `Kernel.t.sol` runs both.

## Policies

`src/policies/` holds the launch policies that back the SDK's `Policy.*` builders. Every one is immutable and
admin-free, and serves every account and session from one deployment:

| Contract          | Kind            | Enforces                                                                                                      |
| ----------------- | --------------- | ------------------------------------------------------------------------------------------------------------- |
| `AllowPolicy`     | action, user op | nothing: the policy for a call allowed without conditions (Smart Sessions needs one per action)               |
| `ArgPolicy`       | action          | conditions on static argument words and the value: `Eq`, `Neq`, `Lt`, `Lte`, `Gt`, `Gte`, `Between`, `OneOf`  |
| `ApprovalPolicy`  | action          | allowed spenders and a cap per token for ERC-20 `approve` and Permit2 `approve` (`increaseAllowance` refused) |
| `SpendPolicy`     | user op         | ERC-20 budgets per token and period across every call (transfers and approvals)                               |
| `ValuePolicy`     | user op         | a native-currency budget per period                                                                           |
| `RateLimitPolicy` | user op         | operations per period                                                                                         |
| `GasPolicy`       | user op         | worst-case gas cost per period                                                                                |
| `SignaturePolicy` | ERC-1271        | which contracts may verify the session's signatures, and conditions on the signed typed data's fields         |

**Periods without TIMESTAMP.** ERC-7562 bans `TIMESTAMP` during validation. The agent appends the time it sends at
as one 32-byte word after the ABI encoding of the account's `execute` calldata (accounts and Smart Sessions ignore it;
the session signature covers it). A limit charges the period containing that time and returns the period's bounds as
validation data, so the EntryPoint only accepts the operation within that period. Periods are epoch-aligned (a day is
a UTC day); a period of 0 is the lifetime and needs no time. Counters are keyed by schedule, never by budget, so
re-enabling a session never resets them. Changing a budget's period (daily to weekly) starts a new counter, so the
session gets a full budget in the new schedule. A counter keeps only its latest period (`usage` reads 0 for an earlier one),
so a new period rewrites its slot instead of filling a fresh one; budgets are capped at 2^208 − 1 and periods at
ERC-4337's 48-bit time.

**Storage.** Every slot is `keccak256(account ‖ x) + n` (`lib/PolicyStorage.sol`), ERC-7562 associated storage;
configurations are stored as words, so no dynamic storage arrays are needed. Each policy takes its ABI configuration
and stores a packed form (`_pack`), which its checks read back with fewer storage reads. On Kernel with `SessionHook`, every
session operation is `executeUserOp(execute(…))`: the policies read the wrapped `execute`, and the time before
`SessionHook`'s tag. `@namera-ai/devnet`'s ERC-7562 test traces
a real session operation's validation and checks both rules on these contracts.

**What the limits can't see.** `SpendPolicy` counts the amount of `transfer`, `transferFrom` and approvals (Permit2's
`approve` of the token included), and refuses any other function of a limited token: it can't tell what
`transferAndCall`, `push` or a share transfer moves. It doesn't see tokens a contract pulls with an allowance given
before the session, nor what a token paymaster takes in `postOp`; an execution policy measuring balances covers those.
`ValuePolicy` counts call values, not gas: the agent sets the fees, which the account pays without a paymaster, so
every session needs a `GasPolicy` (the SDK refuses one without). `SignaturePolicy` checks each signature on its own
(ERC-1271 is a view), so its caps don't add up across signatures. `ArgPolicy` compares whole words, so the SDK adds a
range rule to a lower bound on a narrow integer, against contracts that ignore the bits above the type. Budgets
reset at fixed, epoch-aligned periods, so a session can spend a full budget at the end of one period and again at the
start of the next. Signed approvals (ERC-2612 `permit`, Permit2 permits, EIP-3009) aren't calls, so `SpendPolicy`
doesn't count them; `SignaturePolicy` caps each one. `ApprovalPolicy` doesn't limit a Permit2 approval's expiration,
so the spender keeps the allowance after the session ends.

**The fallback action** (`Policy.anyCall`) never reaches the account's infrastructure: the account itself, Smart
Sessions, the EntryPoint, and installed validators and executors. It also refuses any module lifecycle or hook
function (`onInstall`, `onUninstall`, `preCheck`, `postCheck`), which covers the modules Kernel doesn't report as
installed (hooks, permission signers and policies), and calldata ending in the account's or an EntryPoint's address,
which ERC-2771 contracts (the account's fallback handlers) read as the account or the EntryPoint calling. A call whose
last argument is the account (a vault's `receiver`) therefore needs an explicit action.

**Signatures.** A session key's ERC-1271 signature carries the signed struct's EIP-712 `encodeData`, and Smart Sessions
checks that it hashes to the signed struct before passing it to policies that implement `I1271TypedDataPolicy`.
`SignaturePolicy` uses it to put conditions on single fields: a session may sign USDC permits for one spender up to a
cap, and nothing else. A field rule compares field `index` as an unsigned word (`ArgPolicy`'s conditions); a dynamic or
nested field's word is its hash. `policyData`, which Smart Sessions passes unchecked, is room for later policies that
verify nested fields themselves.

## Execution policies

Validation policies run during `validateUserOp`, where ERC-7562 forbids oracles, balances and the clock, and before the
calls happen. **Execution policies** run around the calls instead, so they can check what an operation actually did.
Namera ships the infrastructure; applications write the policies.

- **`SessionHook`** is both:
  - a session's **user operation policy**: its init data, `abi.encode(ExecutionPolicyData[])` (at most 8), lists the
    session's execution policies, so the owner's session signature covers them;
  - the **hook Kernel binds to Smart Sessions' validation**: Kernel runs every Smart Sessions operation through
    `executeUserOp` and calls the hook around it. Its install data is `abi.encode(address smartSession)`.
- **The tag.** A session operation names its session at the end of its calldata, `… ‖ time ‖ permissionId ‖
  keccak256("namera.session-hook.tag")`. During validation, `SessionHook` requires its session's own tag, a plain
  `execute` (wrapped in `executeUserOp` on Kernel), no call to the hook, the account or the session's execution
  policies, and the hook to still be installed (read from the account). Smart Sessions rejects a tag naming another
  session. During execution the hook reads the tag and runs that session's policies. Calldata, not state, carries the
  session across, so identical operations in one bundle each run them. Untagged operations (the owner's, sessions
  without execution policies) pass through.
- **Guarding the hook.** Once installed, the hook can't be reinstalled for another Smart Sessions module without an
  uninstall, and it refuses `onInstall` and `onUninstall` while a session operation runs (between `preCheck` and
  `postCheck`). It holds that lock around every Smart Sessions operation, tagged or not, since Kernel doesn't report a
  validator's hook as installed; Smart Sessions' fallback refuses the hook's functions by selector.
- **Limits.** The owner should remove sessions with execution policies before uninstalling the hook: an operation
  validated earlier in the same bundle would execute after the uninstall without them. An account that skipped
  `postCheck` after a failed execution would keep the lock for the rest of the transaction; Kernel reverts the whole
  execution instead (sessions only use the default exec type).

### Writing an execution policy

Inherit `src/hooks/ExecutionPolicyBase.sol` (Apache-2.0) and implement:

- `_configure(id, multiplexer, account, initData)`: stores the session's configuration. It runs during validation in
  enable mode, so it follows ERC-7562: storage keyed by the account, no banned opcodes.
- `_preCheck(id, multiplexer, account, execData)`: before the calls. It returns a context, such as balances, which the
  hook hands back unchanged. `execData` is the `execute` calldata, tail included.
- `_postCheck(id, multiplexer, account, context)`: after the calls. Revert to reject the operation.

Rules that keep a policy safe when the agent writes the whole batch:

- **Value with an oracle.** Never use a pool's spot price or a vault's share price, which the same batch can move
  first.
- **Measure outcomes.** Compare balances before and after; don't trust decoded calldata. Balance deltas don't see
  approvals or signatures, so keep `ApprovalPolicy` and the target allowlist on the session too.
- **Never catch, and keep gas bounded.** Any revert, out of gas included, rejects the operation. The hook never
  catches one.
- **Failures cost gas.** A failed execution is included and paid for, unlike a validation failure. Pair execution
  policies with `RateLimitPolicy` and `GasPolicy`, and simulate before sending.
- **Keep state per session.** Key it by `id → multiplexer → account`, as validation policies key on Smart Sessions.

Revert reasons: on Kernel a policy's revert reaches the receipt as `ExecutionPolicyViolation(permissionId, policy,
reason)`, but an inner call's revert is lost (`ExecutionReverted()`). Simulate to explain failures.

## Deterministic deployment

- The address of a contract is `CREATE2(factory, keccak256(label), keccak256(initcode))`. Compiler
  settings in `foundry.toml` are part of the initcode, so they live only in `[profile.default]` and
  must not change after the first deployment. Metadata hashes are disabled for reproducible bytecode.
- **Alpha:** labels stay `namera.<name>.v1` while the contracts change. Changed code deploys to a new
  address under the same label, and its record replaces the old one on each chain it is redeployed to;
  `contracts generate` lists a chain only once it holds the current build. From the first stable
  release, a new contract version gets a new label (`namera.<name>.v<n>`) and therefore a new address,
  and a label is never reused for changed code.
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

`pnpm contracts:deploy` broadcasts `Deploy.s.sol`, then writes `deployments/<chainId>.json`
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
still matches them; a record whose code is gone or changed fails the command. During the alpha, a
record at another address (an earlier build under the same label) is replaced once the current build
is deployed there.
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
