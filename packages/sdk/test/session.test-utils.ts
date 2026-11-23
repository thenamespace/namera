import { SessionHook, SmartSession } from "@namera-ai/contracts"
import { KernelAccount, NexusAccount, Safe7579Account, Session } from "@namera-ai/sdk"
import { concat, encodeAbiParameters, encodeFunctionData, type Hex, pad, parseAbi, toHex } from "viem"
import {
  entryPoint07Abi,
  entryPoint07Address,
  getUserOperationHash,
  type SmartAccount,
  toSmartAccount
} from "viem/account-abstraction"
import type { PrivateKeyAccount } from "viem/accounts"

import { client, devnet, newOwner } from "./accounts/accounts.test-utils.ts"

// An agent sending session operations through Smart Sessions on the devnet, until the agent account (phase 012) does
// it: `execute` calldata, the stated time for periodic limits, SessionHook's tag when asked, and Kernel's
// `executeUserOp` wrapping (SessionHook is bound to Smart Sessions there).

export type AccountType = "kernel" | "nexus" | "safe7579"

const execute = parseAbi(["function execute(bytes32 mode, bytes executionCalldata)"])
const SINGLE = pad("0x00", { dir: "right", size: 32 })
const BATCH = pad("0x01", { dir: "right", size: 32 })
const STUB =
  "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c"

/** A deployed account of `type` with Smart Sessions and SessionHook, funded. */
export const deployedAccount = async (type: AccountType) => {
  const owner = newOwner()
  const account = type === "kernel"
    ? await KernelAccount.from({ client, owner })
    : type === "nexus"
    ? await NexusAccount.from({ client, owner })
    : await Safe7579Account.from({ client, owners: [owner] })
  await devnet.fund(account.address)
  await devnet.deploy(account)
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

// The nonce lane that routes an operation to Smart Sessions on each account.
const nonceKey = (type: AccountType): bigint => {
  switch (type) {
    case "kernel":
      return BigInt(concat(["0x0001", SmartSession.v1.address, "0x0000"]))
    case "nexus":
      return BigInt(SmartSession.v1.address)
    case "safe7579":
      return BigInt(concat([SmartSession.v1.address, "0x00000000"]))
  }
}

/** The agent's view of the account: session operations signed by `sessionKey`. */
export const sessionAgent = (options: {
  readonly type: AccountType
  readonly address: Hex
  readonly session: Session.Session
  readonly sessionKey: PrivateKeyAccount
  /** Appends the stated time (the block's), which periodic limits need. */
  readonly statesTime?: boolean | undefined
  /** Appends SessionHook's tag, which sessions with execution policies need. */
  readonly tagged?: boolean | undefined
}): Promise<SmartAccount> => {
  const permissionId = Session.getPermissionId(options.session)
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
        args: [options.address, nonceKey(options.type)]
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
      const body = concat([call, time, tag])
      return options.type === "kernel" ? concat(["0x8dd7712f", body]) : body
    },
    getStubSignature: async () => concat(["0x00", permissionId, STUB]),
    signMessage: async () => "0x",
    signTypedData: async () => "0x",
    signUserOperation: async ({ chainId = devnet.chain.id, ...operation }) => {
      const hash = getUserOperationHash({
        userOperation: { ...operation, sender: options.address, signature: "0x" },
        entryPointAddress: entryPoint07Address,
        entryPointVersion: "0.7",
        chainId
      })
      return concat(["0x00", permissionId, await options.sessionKey.signMessage({ message: { raw: hash } })])
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
