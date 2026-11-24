import { it } from "@effect/vitest"
import { Grant, type KernelAccount, Policy, Session, SessionKey } from "@namera-ai/sdk"
import { type Hex, parseEther } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"

import { missing } from "./env.test-utils.ts"
import { CIRCLE_PAYMASTER, erc20, errorTag, funderAddress, type Live } from "./operations.test-utils.ts"
import { type ChainRecord, type Outcome, save } from "./results.test-utils.ts"

/** A chain's run: its clients and the record its cells write. */
export interface Run {
  readonly live: Live
  readonly record: ChainRecord
}

/** The longest a cell may take: funding, the bundler's estimate and simulation, and a receipt (120 s). */
export const CELL_TIMEOUT = 300_000
/** Etherspot's cells: its receipts take up to 180 s. */
export const ETHERSPOT_CELL_TIMEOUT = 420_000

/** Adds a row to the chain's results. */
export const record = (run: Run, cell: string, outcome: Outcome, detail: string, seconds: number) => {
  run.record.results.push({ chain: run.record.chain, cell, outcome, detail, seconds })
  save(run.record)
}

/**
 * One cell of the matrix, as one test: `not-configured` when a setting it needs is empty, `skipped` with a reason,
 * otherwise `pass` with what the body returns (an operation's hash) or `fail` with the decoded error's tag. A failing
 * cell fails its test and the run goes on.
 */
export const cell = (
  run: Run,
  name: string,
  options: {
    readonly requires?: ReadonlyArray<string> | undefined
    readonly skip?: string | undefined
    readonly timeout?: number | undefined
  },
  body: () => Promise<string>
): void => {
  it(name, { timeout: options.timeout ?? CELL_TIMEOUT }, async (context) => {
    const absent = missing(options.requires ?? [])
    if (absent.length > 0) {
      record(run, name, "not-configured", `missing ${absent.join(", ")}`, 0)
      return context.skip()
    }
    if (options.skip !== undefined) {
      record(run, name, "skipped", options.skip, 0)
      return context.skip()
    }

    const started = performance.now()
    let detail: string
    try {
      detail = await body()
    } catch (error) {
      const tag = errorTag(error)
      record(run, name, "fail", tag, (performance.now() - started) / 1000)
      // The original error repeats endpoint URLs with their credentials: only the redacted tag leaves the cell.
      // oxlint-disable-next-line preserve-caught-error
      throw new Error(tag)
    }
    record(run, name, "pass", detail, (performance.now() - started) / 1000)
  })
}

/** Records an observation with the chain's results. */
export const note = (run: Run, text: string): void => {
  run.record.notes.push(text)
  save(run.record)
}

/** Each agent USDC transfer, and the per-transfer cap the over-limit refusal exceeds. */
export const TRANSFER = 1_000n
export const TRANSFER_CAP = 10_000n

/** Smart Sessions' `Permit` policy for Circle's paymaster on the chain's USDC (its domain read from the token). */
const circlePermit = async (live: Live) => {
  const [name, version] = await Promise.all([
    live.client.readContract({ address: live.chain.usdc, abi: erc20, functionName: "name" }),
    live.client.readContract({ address: live.chain.usdc, abi: erc20, functionName: "version" })
  ])
  return Policy.signTypedData({
    domain: { name, version, chainId: live.chain.chain.id, verifyingContract: live.chain.usdc },
    types: {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" }
      ]
    },
    primaryType: "Permit",
    message: { spender: CIRCLE_PAYMASTER, value: { lte: 2_000_000n } }
  })
}

/**
 * Grants an agent a USDC-transfer session on the account (to the funder, capped per transfer and per day, with a gas
 * limit, paymasters allowed) and returns its account from `Grant.toAccount`, as the smoke test does.
 */
export const grantAgent = async (
  live: Live,
  account: KernelAccount.KernelAccount,
  options: { readonly circle?: boolean; readonly validAfter?: number; readonly check?: boolean } = {}
) => {
  const signer = privateKeyToAccount(generatePrivateKey())
  const session = Session.from({
    signer: SessionKey.ecdsa(signer.address),
    ...(options.validAfter === undefined ? {} : { validAfter: options.validAfter }),
    validUntil: Session.now() + 2 * 86_400,
    sponsored: true,
    policies: [
      Policy.erc20Transfer({ token: live.chain.usdc, to: [funderAddress()], amount: { lte: TRANSFER_CAP } }),
      Policy.spend({ token: live.chain.usdc, amount: 500_000n, period: "day" }),
      Policy.gas({ maxCost: parseEther("0.2"), period: "day" }),
      ...(options.circle === true ? [await circlePermit(live)] : [])
    ]
  })
  const grant = await Grant.create({ account, session })
  const agent = await Grant.toAccount(live.client, {
    grant: Grant.parse(Grant.serialize(grant)),
    signer,
    ...(options.check === undefined ? {} : { check: options.check })
  })
  return { grant, agent, signer }
}

export type Agent = Awaited<ReturnType<typeof grantAgent>>

export const needs = <A>(value: A | undefined, what: string): A => {
  if (value === undefined) throw new Error(`${what} is missing: an earlier cell failed`)
  return value
}

export const hashOf = (receipt: { readonly receipt: { readonly transactionHash: Hex } }) =>
  receipt.receipt.transactionHash
