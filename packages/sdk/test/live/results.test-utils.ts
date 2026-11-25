import * as fs from "node:fs"
import * as path from "node:path"

import { recordsDirectory, redact } from "./env.test-utils.ts"

// Each chain's test file records its cells in `results/.run/<chain>.json`; the global teardown (`test/setup/live.ts`)
// merges them into `results/<date>.md` with the funder's balances.

export type Outcome = "pass" | "fail" | "skipped" | "not-configured"

export interface CellResult {
  readonly chain: string
  readonly cell: string
  readonly outcome: Outcome
  /** The operation's transaction hash, the error's tag, or why the cell didn't run. */
  readonly detail: string
  readonly seconds: number
}

/** What a chain's run observed besides pass and fail: vendor behaviour worth keeping with the results. */
export interface ChainRecord {
  readonly chain: string
  readonly results: Array<CellResult>
  readonly notes: Array<string>
}

const fileOf = (chain: string) => path.join(recordsDirectory, `${chain.toLowerCase().replace(/\s+/g, "-")}.json`)

export const makeRecord = (chain: string): ChainRecord => ({ chain, results: [], notes: [] })

/** Writes the chain's record after every cell, so an interrupted run still leaves what it did. */
export const save = (record: ChainRecord): void => {
  fs.mkdirSync(recordsDirectory, { recursive: true })
  fs.writeFileSync(fileOf(record.chain), redact(JSON.stringify(record, null, 2)))
}

export const readRecords = (): ReadonlyArray<ChainRecord> =>
  fs.existsSync(recordsDirectory)
    ? fs.readdirSync(recordsDirectory).filter((file) => file.endsWith(".json") && !file.startsWith("_")).map((file) =>
      JSON.parse(fs.readFileSync(path.join(recordsDirectory, file), "utf8")) as ChainRecord
    )
    : []

const cellText = (text: string) => text.replace(/\|/g, "\\|").replace(/\s+/g, " ").slice(0, 240)

/** The results table of one chain, in markdown. */
export const table = (record: ChainRecord): string => {
  const counts = (["pass", "fail", "skipped", "not-configured"] as const).map((outcome) =>
    `${record.results.filter((result) => result.outcome === outcome).length} ${outcome}`
  ).join(", ")
  const rows = record.results.map((result) =>
    `| ${cellText(result.cell)} | ${result.outcome} | ${cellText(result.detail)} | ${result.seconds.toFixed(1)} s |`
  )
  const notes = record.notes.length === 0 ? [] : ["", "Observations:", "", ...record.notes.map((note) => `- ${note}`)]
  return redact([
    `## ${record.chain}`,
    "",
    counts,
    "",
    "| Cell | Result | Operation hash or error | Duration |",
    "| --- | --- | --- | --- |",
    ...rows,
    ...notes
  ].join("\n"))
}
