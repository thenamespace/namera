import { SessionHook, SmartSession } from "@namera-ai/contracts"
import type { Devnet } from "@namera-ai/devnet"
import { type Grant, KernelAccount, NexusAccount, Safe7579Account, Session } from "@namera-ai/sdk"
import * as FastLz from "@namera-ai/sdk/internal/core/grant/fastLz"
import {
  concat,
  encodeAbiParameters,
  encodeFunctionData,
  type Hex,
  pad,
  parseAbi,
  parseAbiParameters,
  toHex
} from "viem"
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

// An agent sending session operations through Smart Sessions on the devnet, until the agent account (phase 012) does
// it: `execute` calldata, the stated time for periodic limits, SessionHook's tag when asked, and Kernel's
// `executeUserOp` wrapping (SessionHook is bound to Smart Sessions there).

export type AccountType = "kernel" | "nexus" | "safe7579"

// Smart Sessions' ENABLE-mode `userOp.signature` (contracts/src/smart-sessions/lib/EncodeLib.sol):
// `0x01 ‖ flzCompress(abi.encode(EnableSession, sessionKeySignature))`. The agent account (phase 012) encodes it in
// the SDK.
const sessionTuple =
  "(address sessionValidator, bytes sessionValidatorInitData, bytes32 salt, (address policy, bytes initData)[] userOpPolicies, ((bytes32 appDomainSeparator, string[] contentNames)[] allowedERC7739Content, (address policy, bytes initData)[] erc1271Policies) erc7739Policies, (bytes4 actionTargetSelector, address actionTarget, (address policy, bytes initData)[] actionPolicies)[] actions, bool permitERC4337Paymaster, uint48 validAfter, uint48 validUntil)"
const enableParameters = parseAbiParameters(
  `(uint8 chainDigestIndex, (uint64 chainId, bytes32 sessionDigest)[] hashesAndChainIds, ${sessionTuple} sessionToEnable, bytes permissionEnableSig), bytes` as string
)
const encodeEnableSignature = (
  enable: {
    readonly chainDigestIndex: number
    readonly hashesAndChainIds: ReadonlyArray<{ readonly chainId: number; readonly sessionDigest: Hex }>
    readonly sessionToEnable: Session.SmartSession
    readonly permissionEnableSig: Hex
  },
  sessionKeySignature: Hex
): Hex =>
  concat([
    "0x01",
    FastLz.compress(
      encodeAbiParameters(enableParameters, [
        {
          ...enable,
          hashesAndChainIds: enable.hashesAndChainIds.map((entry) => ({ ...entry, chainId: BigInt(entry.chainId) }))
        },
        sessionKeySignature
      ] as never)
    )
  ])

const execute = parseAbi(["function execute(bytes32 mode, bytes executionCalldata)"])
const SINGLE = pad("0x00", { dir: "right", size: 32 })
const BATCH = pad("0x01", { dir: "right", size: 32 })
const STUB =
  "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c"

/**
 * An account of `type` with Smart Sessions and SessionHook, funded and deployed (on `on`, the first devnet chain by
 * default), owned by `owner` (a fresh key by default).
 */
export const deployedAccount = async (
  type: AccountType,
  options: {
    readonly on?: Devnet.Devnet | undefined
    readonly owner?: PrivateKeyAccount | WebAuthnAccount | undefined
    readonly deploy?: boolean | undefined
  } = {}
) => {
  const chain = options.on ?? devnet
  const owner = options.owner ?? newOwner()
  const account = type === "kernel"
    ? await KernelAccount.from({ client: chain.client, owner })
    : type === "nexus"
    ? await NexusAccount.from({ client: chain.client, owner })
    : await Safe7579Account.from({ client: chain.client, owners: [owner] as never })
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
  /** The devnet chain the agent sends on (the first by default). */
  readonly on?: Devnet.Devnet | undefined
  /** Sends in ENABLE mode with this grant's entry for the agent's chain, enabling the session first. */
  readonly enable?: Grant.Grant | undefined
}): Promise<SmartAccount> => {
  const permissionId = Session.getPermissionId(options.session)
  const chain = options.on ?? devnet
  const client = chain.client
  const sign = (sessionKeySignature: Hex) => {
    if (options.enable === undefined) return concat(["0x00", permissionId, sessionKeySignature])
    const grant = options.enable
    const index = grant.chains.findIndex((entry) => entry.chain === `eip155:${chain.chain.id}`)
    return encodeEnableSignature({
      chainDigestIndex: index,
      hashesAndChainIds: grant.chains.map((entry) => ({
        chainId: Number(entry.chain.slice("eip155:".length)),
        sessionDigest: entry.sessionDigest
      })),
      sessionToEnable: Session.toSmartSession(grant.session),
      permissionEnableSig: grant.chains[index]!.signature
    }, sessionKeySignature)
  }
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
    getStubSignature: async () => sign(STUB),
    signMessage: async () => "0x",
    signTypedData: async () => "0x",
    signUserOperation: async ({ chainId = chain.chain.id, ...operation }) => {
      const hash = getUserOperationHash({
        userOperation: { ...operation, sender: options.address, signature: "0x" },
        entryPointAddress: entryPoint07Address,
        entryPointVersion: "0.7",
        chainId
      })
      return sign(await options.sessionKey.signMessage({ message: { raw: hash } }))
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
