import { afterAll, describe } from "@effect/vitest"
import { Compat, KernelAccount } from "@namera-ai/sdk"
import { formatUnits, type Hex, slice } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"

import {
  type Agent,
  cell,
  ETHERSPOT_CELL_TIMEOUT,
  grantAgent,
  hashOf,
  needs,
  note,
  record,
  type Run,
  TRANSFER
} from "./cell.test-utils.ts"
import { etherspotFull, type LiveChain } from "./env.test-utils.ts"
import {
  bundlerClient,
  type BundlerName,
  bundlerOf,
  bundlerSettings,
  ETHERSPOT_RECEIPT_TIMEOUT,
  fund,
  funderAddress,
  makeLive,
  type PaymasterName,
  paymasterOf,
  paymasterSettings,
  PIMLICO_PAYMASTER,
  RECEIPT_TIMEOUT,
  selfPaidFunding,
  send,
  sweep,
  usdcApprove,
  usdcBalance,
  usdcTransfer
} from "./operations.test-utils.ts"
import { eip7702Cells, refusalCells, type Shared } from "./refusals.test-utils.ts"
import { makeRecord } from "./results.test-utils.ts"

const BUNDLERS: ReadonlyArray<Exclude<BundlerName, "from">> = ["pimlico", "alchemy", "candide", "zerodev", "etherspot"]
const PAYMASTERS: ReadonlyArray<PaymasterName> = [
  "alchemy",
  "pimlico",
  "zerodev",
  "candide",
  "etherspot",
  "circle",
  "erc7677",
  "pimlico-erc20"
]

const etherspotSkip = etherspotFull ? undefined : "NAMERA_LIVE_ETHERSPOT_FULL=0 (one smoke operation per chain)"
const timeoutOf = (bundler: BundlerName) => bundler === "etherspot" ? ETHERSPOT_CELL_TIMEOUT : undefined
const receiptTimeoutOf = (bundler: BundlerName) => bundler === "etherspot" ? ETHERSPOT_RECEIPT_TIMEOUT : RECEIPT_TIMEOUT

/** Each bundler paying for itself: an owner operation that deploys a fresh account, then an agent's ENABLE and USE. */
const selfPaidCells = (run: Run, bundler: BundlerName) => {
  const { live } = run
  const requires = bundlerSettings[bundler]
  const label = bundler === "from" ? "Bundler.from (Candide's URL)" : `Bundler.${bundler}`
  let account: KernelAccount.KernelAccount | undefined
  let agent: Agent | undefined

  cell(run, `self-paid ${label}: owner op (deploys)`, { requires, timeout: timeoutOf(bundler) }, async () => {
    account = await KernelAccount.from({ client: live.client, owner: privateKeyToAccount(generatePrivateKey()) })
    live.accounts.push(account)
    const config = bundlerOf(bundler, live.chain)
    const client = bundlerClient(live, account, config)
    await fund(live, [{ to: account.address, eth: await selfPaidFunding(config, client), usdc: 10n * TRANSFER }])
    return hashOf(await send(live, client, [usdcTransfer(live, funderAddress(), TRANSFER)], receiptTimeoutOf(bundler)))
  })

  for (const mode of ["ENABLE", "USE"] as const) {
    cell(
      run,
      `self-paid ${label}: agent ${mode}`,
      { requires, skip: bundler === "etherspot" ? etherspotSkip : undefined, timeout: timeoutOf(bundler) },
      async () => {
        if (mode === "ENABLE") agent = await grantAgent(live, needs(account, "the deployed account"))
        const client = bundlerClient(live, needs(agent, "the agent").agent, bundlerOf(bundler, live.chain))
        return hashOf(
          await send(live, client, [usdcTransfer(live, funderAddress(), TRANSFER)], receiptTimeoutOf(bundler))
        )
      }
    )
  }
}

/** Circle's charge for an operation: the permit's amount (from its paymaster data) and the USDC the account lost. */
const circleNote = async (
  run: Run,
  label: string,
  client: ReturnType<typeof bundlerClient>,
  receipt: Awaited<ReturnType<typeof send>>,
  before: bigint,
  sender: Hex
) => {
  const operation = await client.getUserOperation({ hash: receipt.userOpHash })
  const data = operation.userOperation.paymasterData
  const permitted = data === undefined ? undefined : BigInt(slice(data, 21, 53))
  const charged = before - (await usdcBalance(run.live, sender)) - TRANSFER
  note(
    run,
    `${label}: Circle permit ${permitted === undefined ? "?" : formatUnits(permitted, 6)} USDC, charged ${
      formatUnits(charged, 6)
    } USDC for ${receipt.actualGasCost} wei of gas`
  )
}

/**
 * Every paymaster with every bundler `Compat` allows, on one shared account the cells don't need to deploy: an owner
 * operation and an agent operation (USE mode) each. The shared account is deployed and its agent enabled through
 * Alchemy's Gas Manager, so it never holds ETH.
 */
const paymasterCells = (run: Run, shared: Shared) => {
  const { live } = run
  const settings = paymasterSettings(live.chain)
  const alchemyRequires = [...bundlerSettings.pimlico, ...settings.alchemy]
  // Alchemy's Sepolia bundler refuses Kernel's first deployment (CREATE2), so accounts deploy through Pimlico's.
  const deployer = (account: Parameters<typeof bundlerClient>[1], paymaster: PaymasterName) =>
    bundlerClient(live, account, bundlerOf("pimlico", live.chain), paymasterOf(paymaster, live.chain))

  cell(run, "shared account: owner op (deploys) Paymaster.alchemy + Bundler.pimlico", {
    requires: alchemyRequires
  }, async () => {
    const account = await KernelAccount.from({ client: live.client, owner: privateKeyToAccount(generatePrivateKey()) })
    live.accounts.push(account)
    await fund(live, [{ to: account.address, usdc: 1_500_000n }])
    const receipt = await send(live, deployer(account, "alchemy"), [usdcTransfer(live, funderAddress(), TRANSFER)])
    shared.account = account
    return hashOf(receipt)
  })

  cell(run, "shared account: agent ENABLE Paymaster.alchemy + Bundler.pimlico", {
    requires: alchemyRequires
  }, async () => {
    const agent = await grantAgent(live, needs(shared.account, "the shared account"), { circle: true })
    const receipt = await send(live, deployer(agent.agent, "alchemy"), [usdcTransfer(live, funderAddress(), TRANSFER)])
    shared.agent = agent
    return hashOf(receipt)
  })

  // Circle also deploys a counterfactual account in its first operation, paying in USDC only.
  cell(run, "Paymaster.circle + Bundler.pimlico: owner op deploys a fresh account (USDC only)", {
    requires: bundlerSettings.pimlico
  }, async () => {
    const account = await KernelAccount.from({ client: live.client, owner: privateKeyToAccount(generatePrivateKey()) })
    live.accounts.push(account)
    await fund(live, [{ to: account.address, usdc: 500_000n }])
    const client = deployer(account, "circle")
    const receipt = await send(live, client, [usdcTransfer(live, funderAddress(), TRANSFER)])
    await circleNote(run, "circle + pimlico (deploy)", client, receipt, 500_000n, account.address)
    return hashOf(receipt)
  })

  for (const paymaster of PAYMASTERS) {
    const allowed = BUNDLERS.filter((bundler) => Compat.check({ bundler, paymaster, chainId: live.chain.chain.id }).ok)
    for (const bundler of allowed) {
      const requires = [...bundlerSettings[bundler], ...settings[paymaster]]
      const skip = paymaster === "etherspot" && !live.chain.arka
        ? "Arka's policy covers Base Sepolia only"
        : bundler === "etherspot"
        ? etherspotSkip
        : undefined
      const label = `Paymaster.${paymaster === "pimlico-erc20" ? "pimlicoErc20" : paymaster} + Bundler.${bundler}`

      for (const who of ["owner", "agent"] as const) {
        const already = paymaster === "alchemy" && bundler === "pimlico"
        const refusesAgents = who === "agent" &&
          Compat.matrix().paymasters.some((entry) => entry.vendor === paymaster && entry.agents === false)
        cell(run, `${label}: ${who} op`, {
          requires,
          skip: skip ??
            (already
              ? "covered by the shared account's cells"
              : refusesAgents
              ? "Compat refuses it for agents (PAYMASTER_AGENT_UNSUPPORTED)"
              : undefined),
          timeout: timeoutOf(bundler)
        }, async () => {
          const account = who === "owner"
            ? needs(shared.account, "the shared account")
            : needs(shared.agent, "the shared agent").agent
          const client = bundlerClient(
            live,
            account,
            bundlerOf(bundler, live.chain),
            paymasterOf(paymaster, live.chain)
          )
          // Pimlico's ERC-20 mode charges through an allowance: the owner approves the paymaster once.
          const calls = paymaster === "pimlico-erc20" && who === "owner"
            ? [usdcApprove(live, PIMLICO_PAYMASTER, 1_000_000n), usdcTransfer(live, funderAddress(), TRANSFER)]
            : [usdcTransfer(live, funderAddress(), TRANSFER)]
          const before = await usdcBalance(live, account.address)
          const receipt = await send(live, client, calls, receiptTimeoutOf(bundler))
          if (paymaster === "circle") {
            await circleNote(run, `circle + ${bundler} (${who})`, client, receipt, before, account.address)
          }
          return hashOf(receipt)
        })
      }
    }
  }

  // Bundlers that sponsor operations themselves, without a paymaster.
  for (
    const [bundler, label] of [["alchemy", "Bundler.alchemy({ sponsorship })"], [
      "zerodev",
      "Bundler.zerodev({ sponsorship: \"ultra-relay\" })"
    ]] as const
  ) {
    for (const who of ["owner", "agent"] as const) {
      cell(run, `${label}: ${who} op`, {
        requires: [...bundlerSettings[bundler], ...(bundler === "alchemy" ? ["ALCHEMY_BSO_POLICY_ID"] : [])]
      }, async () => {
        const account = who === "owner"
          ? needs(shared.account, "the shared account")
          : needs(shared.agent, "the shared agent").agent
        const client = bundlerClient(live, account, bundlerOf(bundler, live.chain, { sponsored: true }))
        const receipt = await send(live, client, [usdcTransfer(live, funderAddress(), TRANSFER)])
        const operation = await client.getUserOperation({ hash: receipt.userOpHash })
        note(
          run,
          `${label} (${who}): maxFeePerGas ${operation.userOperation.maxFeePerGas}, preVerificationGas ${operation.userOperation.preVerificationGas}, actualGasCost ${receipt.actualGasCost}`
        )
        return hashOf(receipt)
      })
    }
  }
}

/** The whole matrix on one chain, as one sequential describe; its record is written after every cell. */
export const liveMatrix = (chain: LiveChain): void => {
  const run: Run = { live: makeLive(chain), record: makeRecord(chain.name) }
  const shared: Shared = {}

  describe(chain.name, { concurrent: false }, () => {
    for (const bundler of [...BUNDLERS, "from"] as const) selfPaidCells(run, bundler)
    paymasterCells(run, shared)
    eip7702Cells(run)
    refusalCells(run, shared)

    // In a hook, so a filtered or failed run still returns what it parked in its accounts.
    afterAll(async () => {
      const started = performance.now()
      const lines = await sweep(run.live)
      for (const line of lines) note(run, `sweep ${line}`)
      const unswept = lines.filter((line) => line.includes("NOT swept")).length
      record(
        run,
        "sweep leftover ETH and USDC to the funder",
        unswept === 0 ? "pass" : "fail",
        `${lines.length - unswept} of ${lines.length} accounts swept`,
        (performance.now() - started) / 1000
      )
    })
  })
}
