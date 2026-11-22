/**
 * A local chain for tests: anvil and the alto bundler, one pair per Vitest worker, with EntryPoint 0.7, the supported
 * smart accounts and Namera's contracts at their production addresses.
 *
 * **Details**
 *
 * `globalSetup` starts the proxies once per test run; each worker's pair starts on first use. `from` connects a test
 * file to its worker's pair and installs the code on first use, so every test file sees the same chain state.
 *
 * **Gotchas**
 *
 * Needs anvil (Foundry) on the `PATH` and the optional peers `prool` and `@pimlico/alto`. Tests in one file share
 * the chain, so isolate them with `snapshot` and `revert` and run them sequentially.
 *
 * @stability experimental
 * @since 2.0.0
 */
import { Instance } from "prool"
import { Server } from "prool/vitest"
import type { Chain, Hex } from "viem"
import { createClient, defineChain, http, toHex } from "viem"
import { entryPoint07Address } from "viem/account-abstraction"
import { mnemonicToAccount } from "viem/accounts"
import { waitForTransactionReceipt } from "viem/actions"
import { foundry } from "viem/chains"

import { contracts, fixtures } from "./internal/bytecode.ts"

// anvil's well-known development mnemonic; its keys hold test ether on the local chain only.
const mnemonic = "test test test test test test test test test test test junk"

const developmentKey = (addressIndex: number): Hex => {
  const key = mnemonicToAccount(mnemonic, { addressIndex }).getHdKey().privateKey
  if (key === null) throw new Error("TestChain: could not derive a development key")
  return toHex(key)
}

const deployer = mnemonicToAccount(mnemonic, { addressIndex: 0 }).address

// The Arachnid deterministic deployer, which anvil installs at genesis and Namera deploys through on every chain.
const create2Factory = "0x4e59b44847b379578588920cA78FbF26c0B4956C"

/**
 * The serializable context `globalSetup` provides to test workers: the proxy URLs of anvil and alto.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
// A type alias rather than an interface, so it satisfies prool's `Record<string, Context>`.
export type Context = {
  readonly anvil: { readonly url: string }
  readonly alto: { readonly url: string }
}

/**
 * The key `globalSetup` provides its `Context` under; read it in tests with Vitest's `inject`.
 *
 * @stability experimental
 * @category constants
 * @since 2.0.0
 */
export const contextKey = "@namera-ai/sdk/testing/TestChain" as const

/**
 * A worker's local chain and bundler, with the controls tests use to stay independent and deterministic.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export interface TestChain {
  /** The viem chain, pointing at this worker's anvil. */
  readonly chain: Chain
  /** This worker's anvil JSON-RPC URL. */
  readonly rpcUrl: string
  /** This worker's alto JSON-RPC URL, serving EntryPoint 0.7. */
  readonly bundlerUrl: string
  /** Funded private keys for tests; alto's own keys are not among them. */
  readonly keys: ReadonlyArray<Hex>
  /** Saves the chain state and returns its id, for one `revert`. */
  readonly snapshot: () => Promise<Hex>
  /** Restores the state saved by `snapshot`, and restarts alto so it bundles against the restored chain. */
  readonly revert: (id: Hex) => Promise<void>
  /** Mines `blocks` blocks (default 1). */
  readonly mine: (blocks?: number) => Promise<void>
  /** Makes alto bundle and submit every pending user operation now. */
  readonly sendBundleNow: () => Promise<void>
  /** Sets the timestamp, in seconds, of the next block. */
  readonly setTime: (seconds: number) => Promise<void>
}

/**
 * A Vitest global setup function: it starts the servers and returns the function that stops them.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type GlobalSetup = (project: {
  readonly config: { readonly maxWorkers: number }
  provide(key: string, value: unknown): void
}) => Promise<() => Promise<void>>

/**
 * Creates the Vitest global setup that serves anvil and alto, one pair per worker.
 *
 * **When to use**
 *
 * Use as the default export of a file listed in Vitest's `globalSetup`.
 *
 * **Example** (A global setup file)
 *
 * ```ts
 * // test/setup/chain.ts
 * import { TestChain } from "@namera-ai/sdk/testing"
 *
 * export default TestChain.globalSetup()
 * ```
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const globalSetup = (): GlobalSetup => {
  let anvilUrl = ""
  return Server.setup({
    instances: {
      anvil: Instance.anvil({ hardfork: "Prague" }),
      alto: (poolId: number) =>
        Instance.alto({
          entrypoints: [entryPoint07Address],
          rpcUrl: `${anvilUrl}/${poolId}`,
          executorPrivateKeys: [developmentKey(8)],
          utilityPrivateKey: developmentKey(9),
          safeMode: false,
          bundleMode: "manual",
          enableDebugEndpoints: true
        })
    },
    setup(context, project) {
      anvilUrl = context.anvil.url
      project.provide(contextKey, context)
    }
  })
}

/**
 * Connects to the current worker's chain and bundler, installing EntryPoint 0.7, the account fixtures and Namera's
 * contracts on first use.
 *
 * **Example** (Isolating each test)
 *
 * ```ts
 * import { afterEach, beforeEach, inject } from "@effect/vitest"
 * import { TestChain } from "@namera-ai/sdk/testing"
 *
 * // Once per project: types the context the global setup provides.
 * declare module "vitest" {
 *   interface ProvidedContext {
 *     readonly [TestChain.contextKey]: TestChain.Context
 *   }
 * }
 *
 * const chain = await TestChain.from(inject(TestChain.contextKey))
 *
 * let snapshot: `0x${string}`
 * beforeEach(async () => {
 *   snapshot = await chain.snapshot()
 * })
 * afterEach(() => chain.revert(snapshot))
 * ```
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const from = async (context: Context): Promise<TestChain> => {
  const { alto, anvil } = Server.get(context)
  const node = createClient({ transport: http(anvil.url) })
  const bundler = createClient({ transport: http(alto.url) })
  const request = (client: typeof node, method: string, params: ReadonlyArray<unknown> = []) =>
    client.request({ method: method as "eth_chainId", params: params as never })

  const last = contracts.at(-1)
  const installed = last !== undefined && await request(node, "eth_getCode", [last.address, "latest"]) !== "0x"
  if (!installed) {
    for (const { address, code } of fixtures) await request(node, "anvil_setCode", [address, code])
    for (const { address, initcode, label, salt } of contracts) {
      const hash = await request(node, "eth_sendTransaction", [
        { from: deployer, to: create2Factory, data: `${salt}${initcode.slice(2)}` }
      ]) as Hex
      // anvil answers before automine includes the transaction, so wait for the receipt.
      const { status } = await waitForTransactionReceipt(node, { hash, pollingInterval: 10 })
      if (status !== "success" || await request(node, "eth_getCode", [address, "latest"]) === "0x") {
        throw new Error(`TestChain: ${label} did not deploy at ${address}`)
      }
    }
  }
  // Starts alto after the code is in place, so its own setup lands before the first snapshot.
  await request(bundler, "eth_supportedEntryPoints")

  return {
    chain: defineChain({ ...foundry, rpcUrls: { default: { http: [anvil.url] } } }),
    rpcUrl: anvil.url,
    bundlerUrl: alto.url,
    keys: Array.from({ length: 7 }, (_, index) => developmentKey(index + 1)),
    snapshot: () => request(node, "evm_snapshot") as Promise<Hex>,
    // alto caches chain state (block, executor nonce, mempool) that a revert invalidates, and clearing its state is
    // not enough to bundle again; restarting this worker's alto is (about 0.6 s).
    revert: async (id) => {
      await request(node, "evm_revert", [id])
      await alto.restart()
      await request(bundler, "eth_supportedEntryPoints")
    },
    mine: async (blocks = 1) => {
      await request(node, "anvil_mine", [toHex(blocks)])
    },
    sendBundleNow: async () => {
      await request(bundler, "debug_bundler_sendBundleNow")
    },
    setTime: async (seconds) => {
      await request(node, "anvil_setNextBlockTimestamp", [toHex(seconds)])
    }
  }
}
