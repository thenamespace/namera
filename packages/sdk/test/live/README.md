# Live bundler and paymaster matrix

Runs the SDK's bundler and paymaster helpers against the real vendors on Base Sepolia (84532) and Sepolia (11155111):
EntryPoint 0.7, Kernel 3.3 (counterfactual and EIP-7702), owner and agent operations. It is run by hand only, never
in CI, and never by `pnpm test` or `pnpm check`.

## Run it

1. Copy `.env.example` to `.env` here (git-ignored) and fill it in. Every variable is documented there; a vendor
   left empty shows up as `not-configured` instead of failing. The funder must be a dedicated, low-balance test key
   (`NAMERA_LIVE_FUNDER_KEY`) holding ETH and test USDC on both chains.
2. From the repository root: `pnpm test:live` (both chains in parallel, one test file per chain). One chain:
   `pnpm test:live packages/sdk/test/live/Sepolia.test.ts`; some cells: add `-t "<part of the cell name>"`.
3. Read the results in `results/<date>.md` (git-ignored): every cell with `pass`, `fail`, `skipped` or
   `not-configured`, its operation's transaction hash or the decoded error's tag, its duration, observations (Circle's
   permit and charge, bundler sponsorship fees, the sweep), and the funder's balances before and after.

The run refuses to start when the funder holds less than 0.02 ETH or 3 USDC on a chain. It never runs on mainnet.

## What it does

Per chain, sequentially:

- **Self-paid:** each of `Bundler.pimlico`, `alchemy`, `candide`, `zerodev`, `etherspot` and `Bundler.from` (Candide's
  URL) deploys a fresh account with an owner operation, then an agent (`Grant.create`, `Grant.toAccount`) sends its
  ENABLE operation and one in USE mode: a USDC transfer under `Policy.erc20Transfer`, `Policy.spend` and `Policy.gas`.
  Each account gets what its bundler's fees need for the prefund its simulations check (10M gas, 0.0005 to
  0.015 ETH; it spends only what its operations use) and 0.01 USDC.
- **Paymasters:** every `Paymaster.*` with every bundler `Compat.check` allows, an owner and an agent operation each,
  on one shared account deployed and enabled through Alchemy's Gas Manager and Pimlico's bundler (it holds USDC
  only; Alchemy's Sepolia bundler refuses Kernel's first deployment). Circle also deploys a
  fresh account, and the shared agent's session allows Circle's permit (`Policy.signTypedData`). Arka runs on Base
  Sepolia only. Then `Bundler.alchemy({ sponsorship })` and `Bundler.zerodev({ sponsorship: "ultra-relay" })`.
- **EIP-7702:** Pimlico self-paid and Alchemy's Gas Manager, owner and agent; Etherspot refused before signing.
- **Refusals and decoding:** `PAYMASTER_BUNDLER_BOUND` from `Compat`, the same pair sent with `strict: false`
  (`PaymasterError` `BundlerBound`), an over-limit transfer and a revoked grant refused before signing, a policy revert
  and `AA22` decoded from the bundler.
- **Sweep:** every account's leftover ETH and USDC goes back to the funder in a sponsored owner operation, even when
  cells fail or are filtered out.

Etherspot includes operations in about 95 s, so it gets one owner operation per chain unless
`NAMERA_LIVE_ETHERSPOT_FULL=1`. Cells may take up to 5 minutes (7 on Etherspot); a failing cell fails its test and
the run goes on.

Nothing the suite prints or writes contains a secret: errors become their decoded tag, and API keys, RPC URLs and the
funder key are redacted from every line.
