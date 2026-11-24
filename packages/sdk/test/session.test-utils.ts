import { SessionHook, SmartSession } from "@namera-ai/contracts"
import type { Devnet } from "@namera-ai/devnet"
import { KernelAccount, Session } from "@namera-ai/sdk"
import { concat, encodeAbiParameters, encodeFunctionData, type Hex, keccak256, pad, parseAbi, toHex } from "viem"
import {
  entryPoint07Abi,
  entryPoint07Address,
  getUserOperationHash,
  type SmartAccount,
  toSmartAccount,
  type WebAuthnAccount
} from "viem/account-abstraction"
import type { PrivateKeyAccount } from "viem/accounts"

import { devnet, newOwner } from "./accounts/accounts.test-utils.ts"

// A session agent built by hand, for testing compiled sessions without a grant (an owner enables the session): USE
// mode, `execute` calldata, the stated time for periodic limits, SessionHook's tag when asked, and Kernel's
// `executeUserOp` wrapping (SessionHook is bound to Smart Sessions there). Grants' agents use `Grant.toAccount`.

const execute = parseAbi(["function execute(bytes32 mode, bytes executionCalldata)"])
const SINGLE = pad("0x00", { dir: "right", size: 32 })
const BATCH = pad("0x01", { dir: "right", size: 32 })
const STUB =
  "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c"

/**
 * A Kernel account with Smart Sessions and SessionHook, funded and deployed (on `on`, the first devnet chain by
 * default), owned by `owner` (a fresh key by default). With `eip7702`, the owner's own address delegated to Kernel.
 */
export const deployedAccount = async (
  options: {
    readonly on?: Devnet.Devnet | undefined
    readonly owner?: PrivateKeyAccount | WebAuthnAccount | undefined
    readonly deploy?: boolean | undefined
    readonly eip7702?: boolean | undefined
  } = {}
) => {
  const chain = options.on ?? devnet
  if (options.eip7702 === true) {
    const owner = (options.owner ?? newOwner()) as PrivateKeyAccount
    const account = await KernelAccount.fromEip7702({ client: chain.client, owner })
    await chain.fund(account.address)
    // The first operation delegates the address and installs Smart Sessions.
    if (options.deploy !== false) await chain.sendUserOperation(account, [])
    return account
  }
  const account = await KernelAccount.from({ client: chain.client, owner: options.owner ?? newOwner() })
  await chain.fund(account.address)
  if (options.deploy !== false) await chain.deploy(account)
  return account
}

/** Enables the session on the account with an owner operation. */
export const enable = async (
  account: Awaited<ReturnType<typeof deployedAccount>>,
  session: Session.Session
) => {
  const data = encodeFunctionData({
    abi: SmartSession.v1.abi,
    functionName: "enableSessions",
    args: [[Session.toSmartSession(session)]]
  })
  const { success } = await devnet.sendUserOperation(account, [{ to: SmartSession.v1.address, data }])
  if (!success) throw new Error("enabling the session reverted")
}

/** What a session key signs for `hash`: Smart Sessions binds it to the permission id. */
export const bound = (hash: Hex, permissionId: Hex): Hex =>
  keccak256(encodeAbiParameters([{ type: "bytes32" }, { type: "bytes32" }], [hash, permissionId]))

// The nonce lane that routes an operation to Smart Sessions on Kernel.
const nonceKey = BigInt(concat(["0x0001", SmartSession.v1.address, "0x0000"]))

/** The agent's view of the account: session operations signed by `sessionKey`. */
export const sessionAgent = (options: {
  readonly address: Hex
  readonly session: Session.Session
  readonly sessionKey: PrivateKeyAccount
  /** Appends the stated time (the block's), which periodic limits need. */
  readonly statesTime?: boolean | undefined
  /** Appends SessionHook's tag, which sessions with execution policies need. */
  readonly tagged?: boolean | undefined
}): Promise<SmartAccount> => {
  const permissionId = Session.getPermissionId(options.session)
  const client = devnet.client
  const sign = (sessionKeySignature: Hex) => concat(["0x00", permissionId, sessionKeySignature])
  return toSmartAccount({
    client,
    entryPoint: { abi: entryPoint07Abi, address: entryPoint07Address, version: "0.7" },
    getAddress: async () => options.address,
    getFactoryArgs: async () => ({ factory: undefined, factoryData: undefined }),
    getNonce: () =>
      client.readContract({
        address: entryPoint07Address,
        abi: entryPoint07Abi,
        functionName: "getNonce",
        args: [options.address, nonceKey]
      }),
    encodeCalls: async (calls) => {
      const call = calls.length === 1
        ? encodeFunctionData({
          abi: execute,
          args: [SINGLE, concat([calls[0]!.to, toHex(calls[0]!.value ?? 0n, { size: 32 }), calls[0]!.data ?? "0x"])]
        })
        : encodeFunctionData({
          abi: execute,
          args: [
            BATCH,
            encodeAbiParameters(
              [{ type: "tuple[]", components: [{ type: "address" }, { type: "uint256" }, { type: "bytes" }] }],
              [calls.map((entry) => [entry.to, entry.value ?? 0n, entry.data ?? "0x"] as const)]
            )
          ]
        })
      const time = options.statesTime === true ? toHex((await client.getBlock()).timestamp, { size: 32 }) : "0x"
      const tag = options.tagged === true
        ? await client.readContract({ ...SessionHook.v1, functionName: "tag", args: [permissionId] })
        : "0x"
      return concat(["0x8dd7712f", call, time, tag])
    },
    getStubSignature: async () => sign(STUB),
    signMessage: async () => "0x",
    signTypedData: async () => "0x",
    signUserOperation: async ({ chainId = devnet.chain.id, ...operation }) => {
      const hash = getUserOperationHash({
        userOperation: { ...operation, sender: options.address, signature: "0x" },
        entryPointAddress: entryPoint07Address,
        entryPointVersion: "0.7",
        chainId
      })
      return sign(await options.sessionKey.signMessage({ message: { raw: bound(hash, permissionId) } }))
    }
  })
}

/** Resolves with the error the bundler refused an operation with. */
export const refusal = (promise: Promise<unknown>): Promise<string> =>
  promise.then(
    () => {
      throw new Error("expected the bundler to refuse the operation")
    },
    (cause: unknown) => String(cause)
  )
