import {
  BundlerError,
  Compat,
  CompatError,
  Grant,
  KernelAccount,
  PaymasterError,
  PolicyViolationError,
  Session
} from "@namera-ai/sdk"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"

import { type Agent, cell, grantAgent, hashOf, needs, type Run, TRANSFER, TRANSFER_CAP } from "./cell.test-utils.ts"
import {
  bundlerClient,
  bundlerOf,
  bundlerSettings,
  errorTag,
  fund,
  funderAddress,
  paymasterOf,
  paymasterSettings,
  RECEIPT_TIMEOUT,
  rejection,
  selfPaidFunding,
  send,
  usdcTransfer
} from "./operations.test-utils.ts"

/** The account the paymaster cells share, and its agent (with a session that allows Circle's permit). */
export interface Shared {
  account?: KernelAccount.KernelAccount
  agent?: Agent
}

const expectTag = (error: unknown, expected: string, matches: boolean): string => {
  const tag = errorTag(error)
  if (!matches) throw new Error(`expected ${expected}, got ${tag}`)
  return tag
}

/** Kernel through EIP-7702: Pimlico self-paid, Alchemy's Gas Manager sponsored, and Etherspot's refusal. */
export const eip7702Cells = (run: Run): void => {
  const { live } = run
  const settings = paymasterSettings(live.chain)

  const routes = [
    { label: "self-paid Bundler.pimlico", bundler: "pimlico", paymaster: undefined },
    { label: "Paymaster.alchemy + Bundler.alchemy", bundler: "alchemy", paymaster: "alchemy" }
  ] as const
  for (const route of routes) {
    const requires = [
      ...bundlerSettings[route.bundler],
      ...(route.paymaster === undefined ? [] : settings[route.paymaster])
    ]
    let account: KernelAccount.KernelAccount | undefined
    let agent: Agent | undefined
    const clientFor = (target: Parameters<typeof bundlerClient>[1]) =>
      bundlerClient(
        live,
        target,
        bundlerOf(route.bundler, live.chain),
        route.paymaster === undefined ? undefined : paymasterOf(route.paymaster, live.chain)
      )

    cell(run, `EIP-7702 ${route.label}: owner op (delegates)`, { requires }, async () => {
      account = await KernelAccount.fromEip7702({
        client: live.client,
        owner: privateKeyToAccount(generatePrivateKey())
      })
      live.accounts.push(account)
      const client = clientFor(account)
      const eth = route.paymaster === undefined
        ? await selfPaidFunding(bundlerOf(route.bundler, live.chain), client)
        : 0n
      await fund(live, [{ to: account.address, eth, usdc: 10n * TRANSFER }])
      const receipt = await send(live, client, [usdcTransfer(live, funderAddress(), TRANSFER)])
      const code = await live.client.getCode({ address: account.address })
      if (code?.startsWith("0xef0100") !== true) throw new Error("the address was not delegated")
      return hashOf(receipt)
    })

    for (const mode of ["ENABLE", "USE"] as const) {
      cell(run, `EIP-7702 ${route.label}: agent ${mode}`, { requires }, async () => {
        if (mode === "ENABLE") agent = await grantAgent(live, needs(account, "the delegated account"))
        return hashOf(
          await send(live, clientFor(needs(agent, "the agent").agent), [usdcTransfer(live, funderAddress(), TRANSFER)])
        )
      })
    }
  }

  cell(run, "EIP-7702 Bundler.etherspot: refused before signing (EIP7702_UNSUPPORTED)", {
    requires: bundlerSettings.etherspot
  }, async () => {
    const account = await KernelAccount.fromEip7702({
      client: live.client,
      owner: privateKeyToAccount(generatePrivateKey())
    })
    const { problems } = Compat.check({ account, bundler: "etherspot", chainId: live.chain.chain.id })
    if (!problems.some((problem) => problem.code === "EIP7702_UNSUPPORTED")) {
      throw new Error(`Compat.check gave ${problems.map((problem) => problem.code).join(",") || "no problem"}`)
    }
    // No authorization is signed: the bundler helper's fee hook refuses first.
    const client = bundlerClient(live, account, bundlerOf("etherspot", live.chain))
    const error = await rejection(client.sendUserOperation({ calls: [usdcTransfer(live, funderAddress(), TRANSFER)] }))
    return expectTag(
      error,
      "CompatError EIP7702_UNSUPPORTED",
      CompatError.isCompatError(error) &&
        error.reason.problems.some((problem) => problem.code === "EIP7702_UNSUPPORTED")
    )
  })
}

/** Refused combinations, the agent's refusals before signing, and `NameraError.decode` on live failures. */
export const refusalCells = (run: Run, shared: Shared): void => {
  const { live } = run
  const settings = paymasterSettings(live.chain)
  const pimlicoPaymaster = settings.pimlico

  cell(run, "refusal: Compat refuses Paymaster.pimlico + Bundler.alchemy (PAYMASTER_BUNDLER_BOUND)", {
    requires: [...bundlerSettings.alchemy, ...pimlicoPaymaster]
  }, async () => {
    const account = needs(shared.account, "the shared account")
    const paymaster = paymasterOf("pimlico", live.chain)
    const { problems } = Compat.check({ account, bundler: "alchemy", paymaster, chainId: live.chain.chain.id })
    if (!problems.some((problem) => problem.code === "PAYMASTER_BUNDLER_BOUND")) {
      throw new Error(`Compat.check gave ${problems.map((problem) => problem.code).join(",") || "no problem"}`)
    }
    const client = bundlerClient(live, account, bundlerOf("alchemy", live.chain), paymaster)
    const error = await rejection(send(live, client, [usdcTransfer(live, funderAddress(), TRANSFER)]))
    return expectTag(
      error,
      "CompatError PAYMASTER_BUNDLER_BOUND",
      CompatError.isCompatError(error)
        && error.reason.problems.some((problem) => problem.code === "PAYMASTER_BUNDLER_BOUND")
    )
  })

  // `strict: false` sends the refused pair for real: Pimlico's paymaster reverts BundlerNotAllowed (0x55d3ab46).
  for (const bundler of ["alchemy", "candide"] as const) {
    cell(run, `refusal: strict:false Paymaster.pimlico + Bundler.${bundler} decodes to PaymasterError BundlerBound`, {
      requires: [...bundlerSettings[bundler], ...pimlicoPaymaster]
    }, async () => {
      const account = needs(shared.account, "the shared account")
      const client = bundlerClient(
        live,
        account,
        bundlerOf(bundler, live.chain, { strict: false }),
        paymasterOf("pimlico", live.chain)
      )
      const error = await rejection(send(live, client, [usdcTransfer(live, funderAddress(), TRANSFER)]))
      return expectTag(
        error,
        "PaymasterError BundlerBound",
        PaymasterError.isPaymasterError(error) && error.reason._tag === "BundlerBound"
      )
    })
  }

  const sponsoredRequires = [...bundlerSettings.pimlico, ...pimlicoPaymaster]
  const sponsoredClient = (account: Parameters<typeof bundlerClient>[1]) =>
    bundlerClient(live, account, bundlerOf("pimlico", live.chain), paymasterOf("pimlico", live.chain))

  cell(run, "refusal: over-limit agent transfer refused before signing", { requires: sponsoredRequires }, async () => {
    const { agent } = needs(shared.agent, "the shared agent")
    const error = await rejection(
      send(live, sponsoredClient(agent), [usdcTransfer(live, funderAddress(), TRANSFER_CAP + 1n)])
    )
    return expectTag(error, "PolicyViolationError", PolicyViolationError.isPolicyViolationError(error))
  })

  cell(run, "decode: policy revert from the bundler (agent with check: false)", {
    requires: sponsoredRequires
  }, async () => {
    const { grant, signer } = needs(shared.agent, "the shared agent")
    const unchecked = await Grant.toAccount(live.client, { grant, signer, check: false })
    const error = await rejection(
      send(live, sponsoredClient(unchecked), [usdcTransfer(live, funderAddress(), TRANSFER_CAP + 1n)])
    )
    // Decoding names the policy; it maps to a PolicyViolationError reason only where the revert says enough.
    return expectTag(
      error,
      "PolicyViolationError, or BundlerError AA23 naming the policy",
      PolicyViolationError.isPolicyViolationError(error)
        || (BundlerError.isBundlerError(error) && error.reason._tag === "Rejected" && error.reason.aa === "AA23"
          && /^PolicyViolation\((?!unknown)/.test(error.reason.revert ?? ""))
    )
  })

  cell(run, "decode: AA22 (a session not valid yet, check: false)", { requires: sponsoredRequires }, async () => {
    const account = needs(shared.account, "the shared account")
    const { agent } = await grantAgent(live, account, { validAfter: Session.now() + 86_400, check: false })
    const error = await rejection(send(live, sponsoredClient(agent), [usdcTransfer(live, funderAddress(), TRANSFER)]))
    return expectTag(
      error,
      "BundlerError Rejected AA22",
      BundlerError.isBundlerError(error) && error.reason._tag === "Rejected" && error.reason.aa === "AA22"
    )
  })

  cell(run, "refusal: revoked grant refused", {
    requires: [...bundlerSettings.alchemy, ...settings.alchemy]
  }, async () => {
    const account = needs(shared.account, "the shared account")
    const { agent, grant } = needs(shared.agent, "the shared agent")
    const owner = bundlerClient(live, account, bundlerOf("alchemy", live.chain), paymasterOf("alchemy", live.chain))
    const hash = await Grant.revoke(owner, { grant })
    if (hash === undefined) throw new Error("Grant.revoke sent nothing")
    const receipt = await owner.waitForUserOperationReceipt({ hash, timeout: RECEIPT_TIMEOUT })
    await live.client.waitForTransactionReceipt({ hash: receipt.receipt.transactionHash })

    const error = await rejection(send(live, sponsoredClient(agent), [usdcTransfer(live, funderAddress(), TRANSFER)]))
    return `revoked in ${hashOf(receipt)}; ${
      expectTag(error, "PolicyViolationError", PolicyViolationError.isPolicyViolationError(error))
    }`
  })
}
