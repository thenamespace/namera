import * as fs from "node:fs"
import * as path from "node:path"
import type { Chain, Hex, NonceManager } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { baseSepolia, sepolia } from "viem/chains"

// The live matrix's settings, read from `test/live/.env` (git-ignored). Every value that could be a credential is
// kept out of what the suite prints or writes: `redact` replaces them, and every URL loses its path and query.

const envFile = path.join(import.meta.dirname, ".env")
if (fs.existsSync(envFile)) process.loadEnvFile(envFile)

/** A setting, or `undefined` when it is empty. */
export const setting = (name: string): string | undefined => {
  const value = process.env[name]?.trim()
  return value === undefined || value === "" ? undefined : value
}

/** The settings among `names` that are empty. */
export const missing = (names: ReadonlyArray<string>): ReadonlyArray<string> =>
  names.filter((name) => setting(name) === undefined)

const SECRET_NAMES = [
  "NAMERA_LIVE_FUNDER_KEY",
  "NAMERA_LIVE_FUNDER_PASSWORD",
  "RPC_BASE_SEPOLIA",
  "RPC_SEPOLIA",
  "RPC_BASE",
  "PIMLICO_API_KEY",
  "ALCHEMY_API_KEY",
  "CANDIDE_API_KEY",
  "ZERODEV_PROJECT_ID",
  "ETHERSPOT_API_KEY"
]

/** Removes every secret and every URL's path and query from text the suite prints or writes. */
export const redact = (text: string): string => {
  const secrets = SECRET_NAMES.map(setting).filter((value): value is string => value !== undefined)
  const scrubbed = secrets.reduce((out, secret) => out.split(secret).join("***"), text)
  return scrubbed.replace(/(https?:\/\/[^/\s"'`]+)[^\s"'`)]*/g, "$1/…")
}

/** The funder: the dedicated, low-balance test key from `.env` (`NAMERA_LIVE_FUNDER_KEY`; cast keystores are refused). */
export const funderAccount = (options: { readonly nonceManager?: NonceManager | undefined } = {}) => {
  const key = setting("NAMERA_LIVE_FUNDER_KEY")
  if (key !== undefined) return privateKeyToAccount(key as Hex, options)
  const keystore = setting("NAMERA_LIVE_FUNDER_KEYSTORE")
  if (keystore === undefined) throw new Error("set NAMERA_LIVE_FUNDER_KEY or NAMERA_LIVE_FUNDER_KEYSTORE in .env")
  throw new Error("cast keystores are not supported by the live suite yet: set NAMERA_LIVE_FUNDER_KEY")
}

/** One chain of the matrix and its vendor settings. */
export interface LiveChain {
  readonly name: string
  readonly chain: Chain
  readonly rpc: string | undefined
  readonly usdc: Hex
  /** Candide's sponsorship policy for this chain (Candide's policies are per chain). */
  readonly candidePolicy: string | undefined
  /** Arka's policy covers Base Sepolia only. */
  readonly arka: boolean
}

export const baseSepoliaLive: LiveChain = {
  name: "Base Sepolia",
  chain: baseSepolia,
  rpc: setting("RPC_BASE_SEPOLIA"),
  usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  candidePolicy: setting("CANDIDE_SPONSORSHIP_POLICY_ID_BASE_SEPOLIA"),
  arka: true
}

export const sepoliaLive: LiveChain = {
  name: "Sepolia",
  chain: sepolia,
  rpc: setting("RPC_SEPOLIA"),
  usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  candidePolicy: setting("CANDIDE_SPONSORSHIP_POLICY_ID_SEPOLIA"),
  arka: false
}

export const liveChains: ReadonlyArray<LiveChain> = [baseSepoliaLive, sepoliaLive]

/** Etherspot includes operations in about 95 s: it runs one smoke operation per chain unless this is set. */
export const etherspotFull = setting("NAMERA_LIVE_ETHERSPOT_FULL") === "1"

/** Where the run's results go (git-ignored), and the per-chain records the global teardown merges. */
export const resultsDirectory = path.join(import.meta.dirname, "results")
export const recordsDirectory = path.join(resultsDirectory, ".run")
