import { Bundler, type KernelAccount, NameraError, Paymaster } from "@namera-ai/sdk"
import {
  type Chain,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatEther,
  formatUnits,
  type Hex,
  http,
  nonceManager,
  parseAbi,
  parseEther,
  type PublicClient,
  type Transport
} from "viem"
import {
  type BundlerClient,
  createBundlerClient,
  type SmartAccount,
  type UserOperationReceipt
} from "viem/account-abstraction"
import { signAuthorization } from "viem/actions"

import { funderAccount, type LiveChain, redact, setting } from "./env.test-utils.ts"

export const erc20 = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function name() view returns (string)",
  "function version() view returns (string)"
])

/** Pimlico's singleton paymaster for EntryPoint 0.7, which its ERC-20 mode charges through an allowance. */
export const PIMLICO_PAYMASTER: Hex = "0x777777777777AeC03fd955926DbF81597e66834C"

/** Circle's EntryPoint 0.7 paymaster on the testnets. */
export const CIRCLE_PAYMASTER: Hex = "0x31BE08D380A21fc740883c0BC434FcFc88740b58"

/** Receipt timeouts: testnet inclusion, and Etherspot's ~95 s (132 s at worst). */
export const RECEIPT_TIMEOUT = 120_000
export const ETHERSPOT_RECEIPT_TIMEOUT = 180_000

export type BundlerName = "pimlico" | "alchemy" | "candide" | "zerodev" | "etherspot" | "from"

export type PaymasterName =
  | "pimlico"
  | "pimlico-erc20"
  | "alchemy"
  | "candide"
  | "zerodev"
  | "etherspot"
  | "circle"
  | "erc7677"

export const bundlerSettings: Record<BundlerName, ReadonlyArray<string>> = {
  pimlico: ["PIMLICO_API_KEY"],
  alchemy: ["ALCHEMY_API_KEY"],
  candide: ["CANDIDE_API_KEY"],
  zerodev: ["ZERODEV_PROJECT_ID"],
  etherspot: ["ETHERSPOT_API_KEY"],
  from: ["CANDIDE_API_KEY"]
}

export const paymasterSettings = (live: LiveChain): Record<PaymasterName, ReadonlyArray<string>> => ({
  pimlico: ["PIMLICO_API_KEY", "PIMLICO_SPONSORSHIP_POLICY_ID"],
  "pimlico-erc20": ["PIMLICO_API_KEY"],
  alchemy: ["ALCHEMY_API_KEY", "ALCHEMY_GAS_POLICY_ID"],
  candide: [
    "CANDIDE_API_KEY",
    live.chain.id === 84532 ? "CANDIDE_SPONSORSHIP_POLICY_ID_BASE_SEPOLIA" : "CANDIDE_SPONSORSHIP_POLICY_ID_SEPOLIA"
  ],
  zerodev: ["ZERODEV_PROJECT_ID"],
  etherspot: ["ETHERSPOT_API_KEY", "ARKA_POLICY_ID"],
  circle: [],
  erc7677: ["ALCHEMY_API_KEY", "ALCHEMY_GAS_POLICY_ID"]
})

const required = (name: string): string => {
  const value = setting(name)
  if (value === undefined) throw new Error(`${name} is not set`)
  return value
}

const alchemyNetworks: Record<number, string> = { 84532: "base-sepolia", 11155111: "eth-sepolia" }

/** A bundler helper by name; `Bundler.from` points at Candide's standard keyed endpoint. */
export const bundlerOf = (
  name: BundlerName,
  live: LiveChain,
  options: { readonly strict?: boolean; readonly sponsored?: boolean } = {}
): Bundler.Bundler => {
  const strict = options.strict ?? true
  switch (name) {
    case "pimlico":
      return Bundler.pimlico({ apiKey: required("PIMLICO_API_KEY"), strict })
    case "alchemy":
      return Bundler.alchemy({
        apiKey: required("ALCHEMY_API_KEY"),
        strict,
        ...(options.sponsored === true ? { sponsorship: { policyId: required("ALCHEMY_BSO_POLICY_ID") } } : {})
      })
    case "candide":
      return Bundler.candide({ apiKey: required("CANDIDE_API_KEY"), strict })
    case "zerodev":
      return Bundler.zerodev({
        projectId: required("ZERODEV_PROJECT_ID"),
        strict,
        ...(options.sponsored === true ? { sponsorship: "ultra-relay" as const } : {})
      })
    case "etherspot":
      return Bundler.etherspot({ apiKey: required("ETHERSPOT_API_KEY"), strict })
    case "from":
      return Bundler.from({
        url: `https://api.candide.dev/api/v3/${live.chain.id}/${required("CANDIDE_API_KEY")}`,
        strict
      })
  }
}

/** A paymaster helper by name; `Paymaster.erc7677` points at Alchemy's Gas Manager, a standard ERC-7677 endpoint. */
export const paymasterOf = (name: PaymasterName, live: LiveChain): Paymaster.Paymaster => {
  switch (name) {
    case "pimlico":
      return Paymaster.pimlico({
        apiKey: required("PIMLICO_API_KEY"),
        policyId: required("PIMLICO_SPONSORSHIP_POLICY_ID")
      })
    case "pimlico-erc20":
      return Paymaster.pimlicoErc20({ apiKey: required("PIMLICO_API_KEY"), token: live.usdc })
    case "alchemy":
      return Paymaster.alchemy({ apiKey: required("ALCHEMY_API_KEY"), policyId: required("ALCHEMY_GAS_POLICY_ID") })
    case "candide":
      return Paymaster.candide({ apiKey: required("CANDIDE_API_KEY"), policyId: live.candidePolicy! })
    case "zerodev":
      return Paymaster.zerodev({ projectId: required("ZERODEV_PROJECT_ID") })
    case "etherspot":
      return Paymaster.etherspot({ apiKey: required("ETHERSPOT_API_KEY"), policyId: required("ARKA_POLICY_ID") })
    case "circle":
      return Paymaster.circle({ token: "USDC" })
    case "erc7677":
      return Paymaster.erc7677({
        url: `https://${alchemyNetworks[live.chain.id]}.g.alchemy.com/v2/${required("ALCHEMY_API_KEY")}`,
        context: { policyId: required("ALCHEMY_GAS_POLICY_ID") }
      })
  }
}

export type LiveBundlerClient = BundlerClient<Transport, Chain | undefined, SmartAccount>

/** One chain's clients, the funder, and every account the run created (swept back at the end). */
export interface Live {
  readonly chain: LiveChain
  readonly client: PublicClient
  readonly funder: ReturnType<typeof createWalletClient>
  readonly accounts: Array<KernelAccount.KernelAccount>
  readonly notes: Array<string>
}

export const makeLive = (chain: LiveChain): Live => {
  const transport = http(chain.rpc)
  return {
    chain,
    client: createPublicClient({ chain: chain.chain, transport }) as PublicClient,
    funder: createWalletClient({
      chain: chain.chain,
      transport,
      account: funderAccount({ nonceManager })
    }),
    accounts: [],
    notes: []
  }
}

export const funderAddress = (): Hex => funderAccount().address

export const bundlerClient = (
  live: Live,
  account: SmartAccount,
  bundler: Bundler.Bundler,
  paymaster?: Paymaster.Paymaster | undefined
): LiveBundlerClient =>
  createBundlerClient({
    account,
    client: live.client,
    ...bundler,
    ...(paymaster === undefined ? {} : { paymaster })
  }) as unknown as LiveBundlerClient

/** Sends ETH and USDC from the funder, all transfers at once, and waits for them. */
export const fund = async (
  live: Live,
  transfers: ReadonlyArray<{ readonly to: Hex; readonly eth?: bigint; readonly usdc?: bigint }>
): Promise<void> => {
  const account = live.funder.account!
  const hashes = await Promise.all(transfers.flatMap(({ eth, to, usdc }) => [
    ...(eth === undefined || eth === 0n
      ? []
      : [live.funder.sendTransaction({ account, chain: live.chain.chain, to, value: eth })]),
    ...(usdc === undefined || usdc === 0n ? [] : [
      live.funder.writeContract({
        account,
        chain: live.chain.chain,
        address: live.chain.usdc,
        abi: erc20,
        functionName: "transfer",
        args: [to, usdc]
      })
    ])
  ]))
  const receipts = await Promise.all(hashes.map((hash) => live.client.waitForTransactionReceipt({ hash })))
  if (receipts.some((receipt) => receipt.status !== "success")) throw new Error("a funding transfer reverted")
}

/**
 * The ETH a self-paying account needs at the bundler's fees: 10M gas at its `maxFeePerGas`, between 0.0005 and 0.015
 * ETH. Bundlers check the prefund of the limits they simulate with, and an ENABLE operation on Sepolia has limits of
 * about 6M gas; the account spends only what its operations use, and the sweep returns the rest.
 */
export const selfPaidFunding = async (bundler: Bundler.Bundler, client: LiveBundlerClient): Promise<bigint> => {
  const fees = await bundler.userOperation.estimateFeesPerGas({
    account: client.account,
    bundlerClient: client as never,
    userOperation: {} as never
  })
  const need = fees.maxFeePerGas * 10_000_000n
  const floor = parseEther("0.0005")
  const ceiling = parseEther("0.015")
  return need < floor ? floor : need > ceiling ? ceiling : need
}

export const usdcTransfer = (live: Live, to: Hex, amount: bigint) => ({
  to: live.chain.usdc,
  data: encodeFunctionData({ abi: erc20, functionName: "transfer", args: [to, amount] })
})

export const usdcApprove = (live: Live, spender: Hex, amount: bigint) => ({
  to: live.chain.usdc,
  data: encodeFunctionData({ abi: erc20, functionName: "approve", args: [spender, amount] })
})

export const usdcBalance = (live: Live, owner: Hex) =>
  live.client.readContract({ address: live.chain.usdc, abi: erc20, functionName: "balanceOf", args: [owner] })

/**
 * Sends one operation and waits for it, then for the public node to have its block, so the next operation's nonce
 * and the policies' usage are read from a node that has seen it. An EIP-7702 account's first operation carries its
 * signed authorization (viem only stubs it for gas).
 */
export const send = async (
  live: Live,
  client: LiveBundlerClient,
  calls: ReadonlyArray<{ readonly to: Hex; readonly data?: Hex; readonly value?: bigint }>,
  timeout = RECEIPT_TIMEOUT
): Promise<UserOperationReceipt> => {
  const account = client.account
  const authorization = account.authorization !== undefined && !(await account.isDeployed())
    ? await signAuthorization(live.client, account.authorization)
    : undefined
  const hash = await client.sendUserOperation({
    calls: [...calls],
    ...(authorization === undefined ? {} : { authorization })
  } as never)
  const receipt = await client.waitForUserOperationReceipt({ hash, timeout })
  await live.client.waitForTransactionReceipt({ hash: receipt.receipt.transactionHash })
  if (!receipt.success) throw new Error(`the operation reverted on chain (${receipt.receipt.transactionHash})`)
  return receipt
}

/** An error as the results table shows it: the Namera error and reason it decodes to, or the error's name. */
export const errorTag = (error: unknown): string => {
  const decoded = NameraError.decode(error)
  if (NameraError.isNameraError(decoded)) {
    const reason = (decoded as unknown as { readonly reason?: Record<string, unknown> }).reason ?? {}
    const extra = ["aa", "revert", "code", "method"].flatMap((key) =>
      reason[key] === undefined ? [] : [`${key}=${String(reason[key])}`]
    )
    const problems = Array.isArray(reason.problems)
      ? [`problems=${(reason.problems as Array<{ code: string }>).map((problem) => problem.code).join(",")}`]
      : []
    return redact(
      [`${decoded._tag}/${String(reason._tag)}`, ...extra, ...problems, `: ${decoded.shortMessage}`].join(" ")
    ).slice(0, 300)
  }
  return redact(error instanceof Error ? `${error.name}: ${error.message}` : String(error)).slice(0, 300)
}

/** Expects the promise to reject, and returns the decoded error. */
export const rejection = async (promise: Promise<unknown>): Promise<unknown> => {
  const outcome = await promise.then((value) => ({ value }), (error: unknown) => ({ error }))
  if ("value" in outcome) throw new Error("expected a rejection, but it succeeded")
  return NameraError.decode(outcome.error)
}

/**
 * Sends each account's ETH and USDC back to the funder with a sponsored owner operation (Alchemy's Gas Manager through
 * Pimlico's bundler, then Candide's sponsorship through Candide's), so the account keeps nothing and pays no gas.
 */
export const sweep = async (live: Live): Promise<ReadonlyArray<string>> => {
  const funder = funderAddress()
  const lines: Array<string> = []
  const routes: ReadonlyArray<readonly [BundlerName, PaymasterName]> = [["pimlico", "alchemy"], ["candide", "candide"]]
  for (const account of live.accounts) {
    const [eth, usdc] = await Promise.all([
      live.client.getBalance({ address: account.address }),
      usdcBalance(live, account.address)
    ])
    if (eth === 0n && usdc === 0n) continue
    const calls = [
      ...(usdc === 0n ? [] : [usdcTransfer(live, funder, usdc)]),
      ...(eth === 0n ? [] : [{ to: funder, value: eth }])
    ]
    let swept: string | undefined
    const failures: Array<string> = []
    for (const [bundler, paymaster] of routes) {
      try {
        const receipt = await send(
          live,
          bundlerClient(live, account, bundlerOf(bundler, live.chain), paymasterOf(paymaster, live.chain)),
          calls
        )
        swept = `${bundler}+${paymaster} ${receipt.receipt.transactionHash}`
        break
      } catch (error) {
        failures.push(`${bundler}+${paymaster}: ${errorTag(error)}`)
      }
    }
    lines.push(
      `${account.address}: ${formatEther(eth)} ETH, ${formatUnits(usdc, 6)} USDC → ${
        swept ?? `NOT swept (${failures.join("; ")})`
      }`
    )
  }
  return lines
}
