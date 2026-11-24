import * as fs from "node:fs"
import * as path from "node:path"
import { createPublicClient, formatEther, formatUnits, http, parseAbi, parseEther } from "viem"

import {
  funderAccount,
  type LiveChain,
  liveChains,
  recordsDirectory,
  resultsDirectory
} from "../live/env.test-utils.ts"
import { readRecords, table } from "../live/results.test-utils.ts"

// The live matrix's global setup: it refuses to start when the funder is low, and its teardown writes the run's
// results table (`test/live/results/<date>.md`, git-ignored) with what the run spent.

const MIN_ETH = parseEther("0.02")
const MIN_USDC = 3_000_000n

const balanceOf = parseAbi(["function balanceOf(address owner) view returns (uint256)"])

interface Balances {
  readonly eth: bigint
  readonly usdc: bigint
}

const balances = async (live: LiveChain): Promise<Balances> => {
  const client = createPublicClient({ chain: live.chain, transport: http(live.rpc) })
  const address = funderAccount().address
  const [eth, usdc] = await Promise.all([
    client.getBalance({ address }),
    client.readContract({ address: live.usdc, abi: balanceOf, functionName: "balanceOf", args: [address] })
  ])
  return { eth, usdc }
}

const configured = liveChains.filter((live) => live.rpc !== undefined)

const format = ({ eth, usdc }: Balances) => `${formatEther(eth)} ETH, ${formatUnits(usdc, 6)} USDC`

// The machine's calendar date (YYYY-MM-DD), which names the results file.
const localDate = (date: Date) => date.toLocaleDateString("en-CA")

const resultsFile = () => {
  const date = localDate(new Date())
  for (let attempt = 1;; attempt++) {
    const file = path.join(resultsDirectory, attempt === 1 ? `${date}.md` : `${date}-${attempt}.md`)
    if (!fs.existsSync(file)) return file
  }
}

export default async function setup() {
  fs.rmSync(recordsDirectory, { recursive: true, force: true })
  const started = new Date()

  const before = new Map<string, Balances>()
  for (const live of configured) {
    const funds = await balances(live)
    if (funds.eth < MIN_ETH || funds.usdc < MIN_USDC) {
      throw new Error(
        `The funder is too low on ${live.name} (${format(funds)}; needs ${formatEther(MIN_ETH)} ETH and ${
          formatUnits(MIN_USDC, 6)
        } USDC): top it up before running the live matrix`
      )
    }
    before.set(live.name, funds)
  }

  return async () => {
    const records = readRecords()
    if (records.length === 0) return

    const spend = await Promise.all(configured.map(async (live) => {
      const start = before.get(live.name)!
      const end = await balances(live)
      return `| ${live.name} | ${format(start)} | ${format(end)} | ${formatEther(start.eth - end.eth)} ETH, ${
        formatUnits(start.usdc - end.usdc, 6)
      } USDC |`
    }))
    const order = configured.map((live) => live.name)
    const sorted = [...records].sort((a, b) => order.indexOf(a.chain) - order.indexOf(b.chain))

    const markdown = [
      `# Live bundler and paymaster matrix, ${localDate(started)}`,
      "",
      `Run started ${started.toISOString()}, finished ${new Date().toISOString()}. EntryPoint 0.7, Kernel 3.3.`,
      "",
      "## Funder",
      "",
      "| Chain | Before | After | Spent (incl. funds parked in test accounts) |",
      "| --- | --- | --- | --- |",
      ...spend,
      "",
      ...sorted.map(table).flatMap((section) => [section, ""])
    ].join("\n")

    fs.mkdirSync(resultsDirectory, { recursive: true })
    const file = resultsFile()
    fs.writeFileSync(file, markdown)
    fs.rmSync(recordsDirectory, { recursive: true, force: true })
    console.log(`Live matrix results: ${path.relative(process.cwd(), file)}`)
  }
}
