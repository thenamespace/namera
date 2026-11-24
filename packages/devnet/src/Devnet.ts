/**
 * A local devnet for tests: anvil and the alto bundler, one pair per Vitest worker, with EntryPoint 0.7, Kernel 3.3
 * (factory, implementation, staked FactoryStaker and ECDSA validator) and Namera's contracts at their production
 * addresses, and the controls tests need.
 *
 * alto runs in safe mode only: it traces every user operation's validation and rejects what breaks ERC-7562, as the
 * shared mempool does, so a test that passes here does not rely on a lenient bundler. EntryPoint stakes match
 * mainnet's.
 *
 * **Details**
 *
 * `globalSetup` starts the proxies once per test run; each worker's pair starts on first use. `from` connects a test
 * file to its worker's pair and installs the code on first use, so every test file sees the same chain state.
 *
 * **Gotchas**
 *
 * Needs anvil (Foundry) on the `PATH`. Tests in one file share the devnet, so isolate them with `isolate` (or
 * `snapshot` and `revert`) and run them sequentially.
 *
 * @stability experimental
 * @since 0.1.0
 */
import { Instance } from "prool"
import { Server } from "prool/vitest"
import type { Chain, Hex, HttpTransport, PublicClient, TransactionReceipt, Transport } from "viem"
import {
  createClient,
  createPublicClient,
  defineChain,
  encodeFunctionData,
  http,
  pad,
  parseAbi,
  parseEther,
  toHex
} from "viem"
import {
  type BundlerClient,
  createBundlerClient,
  entryPoint07Address,
  type SmartAccount
} from "viem/account-abstraction"
import { mnemonicToAccount } from "viem/accounts"
import { signAuthorization, waitForTransactionReceipt } from "viem/actions"
import { foundry } from "viem/chains"

import { contracts, fixtures } from "./internal/bytecode.ts"

// anvil's well-known development mnemonic; its keys hold test ether on the local chain only.
const mnemonic = "test test test test test test test test test test test junk"

const developmentKey = (addressIndex: number): Hex => {
  const key = mnemonicToAccount(mnemonic, { addressIndex }).getHdKey().privateKey
  if (key === null) throw new Error("Devnet: could not derive a development key")
  return toHex(key)
}

const deployer = mnemonicToAccount(mnemonic, { addressIndex: 0 }).address

// The Arachnid deterministic deployer, which anvil installs at genesis and Namera deploys through on every chain.
const create2Factory = "0x4e59b44847b379578588920cA78FbF26c0B4956C"

// ZeroDev's FactoryStaker and the Kernel 3.3 factory it deploys through (`@namera-ai/contracts` `External.kernel`).
const kernelFactoryStaker = "0xd703aaE79538628d27099B8c4f621bE4CCd142d5"
const kernelFactory = "0x2577507b78c2008Ff367261CB6285d44ba5eF2E9"
// Solady `Ownable`'s owner slot.
const ownerSlot = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffff74873927"

/**
 * Gives the FactoryStaker the state it has on every mainnet: it approves the Kernel 3.3 factory and holds 0.1 ether of
 * EntryPoint stake with a one-day unstake delay. ERC-7562 lets account deployment write a module's storage for the
 * account (STO-022) only through a staked factory, so alto's safe mode needs the stake too.
 */
const stakeKernelFactory = async (
  request: (method: string, params?: ReadonlyArray<unknown>) => Promise<unknown>,
  transact: (
    label: string,
    transaction: { readonly to: Hex; readonly data: Hex; readonly value?: Hex }
  ) => Promise<void>
) => {
  await request("anvil_setStorageAt", [kernelFactoryStaker, ownerSlot, pad(deployer)])
  await transact("approving the Kernel factory", {
    to: kernelFactoryStaker,
    data: encodeFunctionData({
      abi: parseAbi(["function approveFactory(address factory, bool approval)"]),
      args: [kernelFactory, true]
    })
  })
  await transact("staking the Kernel FactoryStaker", {
    to: kernelFactoryStaker,
    value: toHex(parseEther("0.1")),
    data: encodeFunctionData({
      abi: parseAbi(["function stake(address entryPoint, uint32 unstakeDelay) payable"]),
      args: [entryPoint07Address, 86_400]
    })
  })
}

/**
 * The serializable context `globalSetup` provides to test workers: the proxy URLs of anvil and alto.
 *
 * @stability experimental
 * @category models
 * @since 0.1.0
 */
// A type alias rather than an interface, so it satisfies prool's `Record<string, Context>`.
export type Context = {
  readonly anvil: { readonly url: string }
  readonly alto: { readonly url: string }
  readonly anvil2: { readonly url: string }
  readonly alto2: { readonly url: string }
}

/**
 * The chain ids of the devnet's two chains: the default one, and a second one for multichain tests.
 *
 * @stability experimental
 * @category constants
 * @since 0.1.0
 */
export const chainIds = { first: 31337, second: 31338 } as const

/**
 * The key `globalSetup` provides its `Context` under; read it in tests with Vitest's `inject`.
 *
 * @stability experimental
 * @category constants
 * @since 0.1.0
 */
export const contextKey = "@namera-ai/devnet/Devnet" as const

/**
 * A call a user operation makes.
 *
 * @stability experimental
 * @category models
 * @since 0.1.0
 */
export interface Call {
  readonly to: Hex
  readonly value?: bigint | undefined
  readonly data?: Hex | undefined
}

/**
 * A viem bundler client on the devnet's alto, for a smart account.
 *
 * @stability experimental
 * @category models
 * @since 0.1.0
 */
export type DevnetBundler = BundlerClient<HttpTransport, Chain, SmartAccount, PublicClient<Transport, Chain>>

/**
 * A worker's devnet, with the controls tests use to stay independent and deterministic.
 *
 * @stability experimental
 * @category models
 * @since 0.1.0
 */
export interface Devnet {
  /** The viem chain, pointing at this worker's anvil. */
  readonly chain: Chain
  /** A public client on this worker's anvil. */
  readonly client: PublicClient<Transport, Chain>
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
  /** Runs each test of a file on a fresh snapshot: pass Vitest's `beforeEach` and `afterEach`. */
  readonly isolate: (hooks: {
    readonly beforeEach: (f: () => Promise<void>) => void
    readonly afterEach: (f: () => Promise<void>) => void
  }) => void
  /** Mines `blocks` blocks (default 1). */
  readonly mine: (blocks?: number) => Promise<void>
  /** Sets the timestamp, in seconds, of the next block. */
  readonly setTime: (seconds: number) => Promise<void>
  /** Sets an address's balance (default 1 ether). */
  readonly fund: (address: Hex, wei?: bigint) => Promise<void>
  /** Makes alto bundle and submit every pending user operation now. */
  readonly sendBundleNow: () => Promise<void>
  /**
   * Deploys an account by sending its factory call as a plain transaction, as a relayer would, for tests that need
   * the account deployed before their first user operation.
   */
  readonly deploy: (account: SmartAccount) => Promise<void>
  /**
   * A bundler client for an account. With `bundleOnReceipt`, it bundles alto's mempool when it first asks for a
   * receipt, so functions that send and then wait complete without the test polling.
   */
  readonly bundlerClient: (account: SmartAccount, options?: { readonly bundleOnReceipt?: boolean }) => DevnetBundler
  /**
   * Sends one user operation, bundles it at once and returns its receipt. An EIP-7702 account's first operation
   * carries the owner's signed authorization.
   */
  readonly sendUserOperation: (
    account: SmartAccount,
    calls: ReadonlyArray<Call>
  ) => Promise<{ readonly success: boolean; readonly receipt: TransactionReceipt }>
}

/**
 * A Vitest global setup function: it starts the servers and returns the function that stops them.
 *
 * @stability experimental
 * @category models
 * @since 0.1.0
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
 * // test/setup/devnet.ts
 * import { Devnet } from "@namera-ai/devnet"
 *
 * export default Devnet.globalSetup()
 * ```
 *
 * @stability experimental
 * @category constructors
 * @since 0.1.0
 */
export const globalSetup = (): GlobalSetup => {
  const urls = { first: "", second: "" }
  // A worker's alto for one of its chains; `rpcUrl` is that chain's anvil, which starts on first use.
  const alto = (chain: keyof typeof urls) => (poolId: number) =>
    Instance.alto({
      entrypoints: [entryPoint07Address],
      rpcUrl: `${urls[chain]}/${poolId}`,
      executorPrivateKeys: [developmentKey(8)],
      utilityPrivateKey: developmentKey(9),
      // Always on: see the module documentation. `patches/@pimlico__alto@0.0.21.patch` makes it work on anvil.
      safeMode: true,
      bundleMode: "manual",
      enableDebugEndpoints: true
    })
  return Server.setup({
    instances: {
      // Osaka, as mainnet: it has the P-256 precompile (EIP-7951) passkey validators use. prool 0.3.0's type predates
      // Osaka; anvil takes the name.
      anvil: Instance.anvil({ hardfork: "Osaka" as never, chainId: chainIds.first }),
      alto: alto("first"),
      // The second chain starts only for the tests that connect to it (`from(context, { chain: "second" })`).
      anvil2: Instance.anvil({ hardfork: "Osaka" as never, chainId: chainIds.second }),
      alto2: alto("second")
    },
    setup(context, project) {
      urls.first = context.anvil.url
      urls.second = context.anvil2.url
      project.provide(contextKey, context)
    }
  })
}

/**
 * Connects to the current worker's devnet, installing EntryPoint 0.7, Kernel 3.3 and Namera's contracts on first
 * use. `chain: "second"` connects to the worker's second chain (chain id 31338), with the same contracts, for
 * multichain tests.
 *
 * **Example** (Isolating each test)
 *
 * ```ts
 * import { afterEach, beforeEach, inject } from "@effect/vitest"
 * import { Devnet } from "@namera-ai/devnet"
 *
 * // Once per project: types the context the global setup provides.
 * declare module "vitest" {
 *   interface ProvidedContext {
 *     readonly [Devnet.contextKey]: Devnet.Context
 *   }
 * }
 *
 * const devnet = await Devnet.from(inject(Devnet.contextKey))
 * devnet.isolate({ beforeEach, afterEach })
 * ```
 *
 * @stability experimental
 * @category constructors
 * @since 0.1.0
 */
export const from = async (
  context: Context,
  options: { readonly chain?: "first" | "second" | undefined } = {}
): Promise<Devnet> => {
  const servers = Server.get(context)
  const second = options.chain === "second"
  const anvil = second ? servers.anvil2 : servers.anvil
  const alto = second ? servers.alto2 : servers.alto
  const node = createClient({ transport: http(anvil.url) })
  const bundler = createClient({ transport: http(alto.url) })
  const request = (client: typeof node, method: string, params: ReadonlyArray<unknown> = []) =>
    client.request({ method: method as "eth_chainId", params: params as never })

  const last = contracts.at(-1)
  const installed = last !== undefined && await request(node, "eth_getCode", [last.address, "latest"]) !== "0x"
  // anvil answers before automine includes a transaction, so wait for the receipt.
  const transact = async (
    label: string,
    transaction: { readonly to: Hex; readonly data: Hex; readonly value?: Hex }
  ) => {
    const hash = await request(node, "eth_sendTransaction", [{ from: deployer, ...transaction }]) as Hex
    const { status } = await waitForTransactionReceipt(node, { hash, pollingInterval: 10 })
    if (status !== "success") throw new Error(`Devnet: ${label} failed`)
  }
  if (!installed) {
    for (const { address, code } of fixtures) await request(node, "anvil_setCode", [address, code])
    await stakeKernelFactory(request.bind(undefined, node), transact)
    for (const { address, initcode, label, salt } of contracts) {
      await transact(`deploying ${label}`, { to: create2Factory, data: `${salt}${initcode.slice(2)}` })
      if (await request(node, "eth_getCode", [address, "latest"]) === "0x") {
        throw new Error(`Devnet: ${label} did not deploy at ${address}`)
      }
    }
  }
  // Starts alto after the code is in place, so its own setup lands before the first snapshot.
  await request(bundler, "eth_supportedEntryPoints")

  const chain = defineChain({
    ...foundry,
    ...(second ? { id: chainIds.second, name: "Foundry 2" } : {}),
    rpcUrls: { default: { http: [anvil.url] } }
  })
  const client: PublicClient<Transport, Chain> = createPublicClient({ chain, transport: http(anvil.url) })

  const snapshot = () => request(node, "evm_snapshot") as Promise<Hex>
  // alto caches chain state (block, executor nonce, mempool) that a revert invalidates, and clearing its state is not
  // enough to bundle again; restarting this worker's alto is (about 0.6 s).
  const revert = async (id: Hex) => {
    await request(node, "evm_revert", [id])
    await alto.restart()
    await request(bundler, "eth_supportedEntryPoints")
  }
  const sendBundleNow = async () => {
    await request(bundler, "debug_bundler_sendBundleNow")
  }

  // alto has the receipt as soon as `sendBundleNow` returns, so a short polling interval finds it on the first poll.
  const bundlerClient = (
    account: SmartAccount,
    options: { readonly bundleOnReceipt?: boolean } = {}
  ): DevnetBundler => {
    let bundled = false
    return createBundlerClient({
      account,
      client,
      pollingInterval: 50,
      transport: http(alto.url, {
        onFetchRequest: async (request) => {
          if (options.bundleOnReceipt !== true || bundled) return
          if (!(await request.clone().text()).includes("eth_getUserOperationReceipt")) return
          bundled = true
          await sendBundleNow()
        }
      })
    })
  }

  return {
    chain,
    client,
    rpcUrl: anvil.url,
    bundlerUrl: alto.url,
    keys: Array.from({ length: 7 }, (_, index) => developmentKey(index + 1)),
    snapshot,
    revert,
    isolate: (hooks) => {
      let id: Hex
      hooks.beforeEach(async () => {
        id = await snapshot()
      })
      hooks.afterEach(() => revert(id))
    },
    mine: async (blocks = 1) => {
      await request(node, "anvil_mine", [toHex(blocks)])
    },
    setTime: async (seconds) => {
      await request(node, "anvil_setNextBlockTimestamp", [toHex(seconds)])
    },
    fund: async (address, wei = parseEther("1")) => {
      await request(node, "anvil_setBalance", [address, toHex(wei)])
    },
    sendBundleNow,
    deploy: async (account) => {
      const { factory, factoryData } = await account.getFactoryArgs()
      if (factory === undefined || factoryData === undefined) throw new Error("Devnet: the account has no factory")
      await transact("deploying the account", { to: factory, data: factoryData })
      if (!(await account.isDeployed())) throw new Error(`Devnet: no account deployed at ${account.address}`)
    },
    bundlerClient,
    sendUserOperation: async (account, calls) => {
      const bundler = bundlerClient(account)
      // viem only stubs an EIP-7702 account's authorization for gas; the first operation needs it signed.
      const authorization = account.authorization !== undefined && !(await account.isDeployed())
        ? await signAuthorization(client, account.authorization)
        : undefined
      const hash = await bundler.sendUserOperation({
        calls: [...calls],
        ...(authorization === undefined ? {} : { authorization })
      })
      await sendBundleNow()
      const { receipt, success } = await bundler.waitForUserOperationReceipt({ hash })
      return { success, receipt }
    }
  }
}
