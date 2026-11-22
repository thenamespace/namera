import * as Effect from "effect/Effect"
import type {
  Chain,
  Client,
  Hex,
  JsonRpcAccount,
  LocalAccount,
  PrivateKeyAccount,
  SignableMessage,
  Transport,
  TypedDataDefinition
} from "viem"
import {
  entryPoint07Abi,
  entryPoint07Address,
  getUserOperationHash,
  type SmartAccount,
  type SmartAccountImplementation,
  toSmartAccount
} from "viem/account-abstraction"
import { getCode, readContract, signMessage, signTypedData } from "viem/actions"

import type * as ChainError from "../../ChainError.ts"
import { fromUnknown } from "../../internal/chainError.ts"
import type { Call } from "../../internal/core/account/erc7579.ts"
import { run } from "../../internal/promise.ts"
import * as AccountError from "../AccountError.ts"

/**
 * What Namera records about an account it built, as the read-only `namera` field.
 */
export interface Metadata<Type extends "kernel" | "nexus" | "safe7579" = "kernel" | "nexus" | "safe7579"> {
  readonly type: Type
  readonly version: string
  readonly entryPoint: "0.7"
  readonly eip7702: boolean
}

/**
 * A viem smart account Namera built, with its `namera` metadata.
 */
export type NameraSmartAccount<Type extends Metadata["type"] = Metadata["type"]> = SmartAccount<
  SmartAccountImplementation<typeof entryPoint07Abi, "0.7", { readonly namera: Metadata<Type> }>
>

/** An owner that signs through viem: a local key or a JSON-RPC (EIP-1193) wallet account. */
export type Owner = LocalAccount | JsonRpcAccount

/** The client accounts are built with: it must name its chain. */
export type AccountClient = Client<Transport, Chain | undefined, Owner | undefined>

/**
 * Everything that differs between account types; `make` turns it into a viem smart account.
 *
 * @internal
 */
export interface Adapter<Type extends Metadata["type"]> {
  readonly metadata: Metadata<Type>
  readonly client: Client<Transport, Chain, Owner | undefined>
  readonly address: Hex
  readonly factory?: { readonly address: Hex; readonly data: Hex } | undefined
  readonly authorization?: { readonly account: PrivateKeyAccount; readonly address: Hex } | undefined
  readonly nonceKey: bigint
  readonly stubSignature: Hex
  readonly encodeCalls: (calls: ReadonlyArray<Call>) => Hex
  /** Calls the first user operation runs before the caller's, for accounts without a factory (EIP-7702). */
  readonly firstCalls?: ReadonlyArray<Call> | undefined
  readonly signUserOperationHash: (hash: Hex) => Effect.Effect<Hex, AccountError.AccountError>
  readonly signMessage: (message: SignableMessage) => Effect.Effect<Hex, AccountError.AccountError>
  readonly signTypedData: (typedData: TypedDataDefinition) => Effect.Effect<Hex, AccountError.AccountError>
}

/**
 * Checks the client names its chain: viem's smart accounts read `client.chain.id` for nonces and signatures.
 *
 * @internal
 */
export const requireChain = (
  client: AccountClient,
  account: AccountError.Options["account"]
): Effect.Effect<Client<Transport, Chain, Owner | undefined>, AccountError.AccountError> =>
  client.chain === undefined
    ? Effect.fail(AccountError.invalidOptions({ account, detail: "the client has no chain" }))
    : Effect.succeed(client as Client<Transport, Chain, Owner | undefined>)

/**
 * Signs through viem's wallet actions, so local keys sign locally and JSON-RPC accounts through the client.
 *
 * @internal
 */
export const ownerSigner = (
  client: Client<Transport, Chain, Owner | undefined>,
  owner: Owner,
  account: AccountError.Options["account"]
) => {
  const failed = (cause: unknown) => AccountError.signingFailed({ account, cause })
  return {
    signMessage: (message: SignableMessage): Effect.Effect<Hex, AccountError.AccountError> =>
      Effect.tryPromise({ try: () => signMessage(client, { account: owner, message }), catch: failed }),
    signTypedData: (typedData: TypedDataDefinition): Effect.Effect<Hex, AccountError.AccountError> =>
      Effect.tryPromise({
        try: () => signTypedData(client, { account: owner, ...typedData } as Parameters<typeof signTypedData>[1]),
        catch: failed
      })
  }
}

/**
 * Builds the viem smart account for an adapter. viem calls its methods as Promises, so each runs through the Promise
 * boundary and rejects with the same `AccountError` or `ChainError` the Effect form fails with.
 *
 * @internal
 */
export const make = <Type extends Metadata["type"]>(
  adapter: Adapter<Type>
): Effect.Effect<NameraSmartAccount<Type>, AccountError.AccountError> => {
  const { address, client } = adapter
  const account = { type: adapter.metadata.type, address }

  const isDeployed: Effect.Effect<boolean, ChainError.ChainError> = Effect.tryPromise({
    try: () => getCode(client, { address }),
    catch: (cause) => fromUnknown(cause, "eth_getCode")
  }).pipe(Effect.map((code) => code !== undefined && code !== "0x"))

  const getNonce: Effect.Effect<bigint, ChainError.ChainError> = Effect.tryPromise({
    try: () =>
      readContract(client, {
        address: entryPoint07Address,
        abi: entryPoint07Abi,
        functionName: "getNonce",
        args: [address, adapter.nonceKey]
      }),
    catch: (cause) => fromUnknown(cause, "eth_call")
  })

  const implementation = {
    client,
    entryPoint: { abi: entryPoint07Abi, address: entryPoint07Address, version: "0.7" },
    extend: { namera: adapter.metadata },
    ...(adapter.authorization === undefined ? {} : { authorization: adapter.authorization }),
    getAddress: () => Promise.resolve(address),
    getFactoryArgs: () =>
      Promise.resolve(
        adapter.factory === undefined
          ? { factory: undefined, factoryData: undefined }
          : { factory: adapter.factory.address, factoryData: adapter.factory.data }
      ),
    // The owner always uses its own nonce lane; viem's per-call nonce keys would land on another validator.
    getNonce: () => run(getNonce),
    encodeCalls: (calls: ReadonlyArray<Call>) =>
      adapter.firstCalls === undefined
        ? Promise.resolve(adapter.encodeCalls(calls))
        : run(isDeployed.pipe(Effect.map((deployed) =>
          adapter.encodeCalls(deployed ? calls : [...adapter.firstCalls!, ...calls])
        ))),
    getStubSignature: () => Promise.resolve(adapter.stubSignature),
    signMessage: ({ message }: { message: SignableMessage }) => run(adapter.signMessage(message)),
    signTypedData: (typedData: TypedDataDefinition) => run(adapter.signTypedData(typedData)),
    signUserOperation: (userOperation: Parameters<SmartAccountImplementation["signUserOperation"]>[0]) => {
      const { chainId = client.chain.id, ...operation } = userOperation
      const hash = getUserOperationHash({
        userOperation: { ...operation, sender: operation.sender ?? address, signature: "0x" },
        entryPointAddress: entryPoint07Address,
        entryPointVersion: "0.7",
        chainId
      })
      return run(adapter.signUserOperationHash(hash))
    }
  } as SmartAccountImplementation<typeof entryPoint07Abi, "0.7", { readonly namera: Metadata<Type> }>

  return Effect.tryPromise({
    try: () => toSmartAccount(implementation),
    catch: (cause) => AccountError.notSupported({ account, detail: "viem could not build the account", cause })
  }) as Effect.Effect<NameraSmartAccount<Type>, AccountError.AccountError>
}
