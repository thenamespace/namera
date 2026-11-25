import * as Effect from "effect/Effect"

import type * as ChainError from "../../ChainError.ts"
import { fromUnknown, isForeign } from "../../internal/chainError.ts"
import type { Call } from "../../internal/core/account/erc7579.ts"
import { isNameraError } from "../../internal/nameraError.ts"
import { run } from "../../internal/promise.ts"
import { annotate, chainIdsOf, traced } from "../../internal/span.ts"
import {
  type AccountClient,
  type ChainClient,
  code,
  context,
  hasChain,
  type Hex,
  type PrivateKeyAccount
} from "../../internal/viem/client.ts"
import type { SignableMessage, TypedDataDefinition } from "../../internal/viem/signing.ts"
import {
  build,
  entryPoint,
  type EntryPointAbi,
  nonce,
  type SmartAccount,
  type SmartAccountImplementation,
  userOperationHash
} from "../../internal/viem/smartAccount.ts"
import * as AccountError from "../AccountError.ts"

/**
 * What Namera records about an account it built, as the read-only `namera` field.
 */
export interface Metadata<Type extends "kernel" = "kernel"> {
  readonly type: Type
  readonly version: string
  readonly entryPoint: "0.7"
  readonly eip7702: boolean
}

/**
 * A viem smart account Namera built, with its `namera` metadata.
 */
export type NameraSmartAccount<Type extends Metadata["type"] = Metadata["type"]> = SmartAccount<
  SmartAccountImplementation<EntryPointAbi, "0.7", { readonly namera: Metadata<Type> }>
>

/**
 * Checks the client names its chain: signatures and nonces need its id.
 *
 * @internal
 */
export const requireChain = (
  client: AccountClient,
  account: AccountError.Options["account"]
): Effect.Effect<ChainClient, AccountError.AccountError> =>
  hasChain(client)
    ? Effect.succeed(client)
    : Effect.fail(AccountError.invalidOptions({ account, detail: "the client has no chain" }))

const accountOf = (implementation: SmartAccountImplementation): AccountError.Options["account"] => {
  const extend = implementation.extend as { readonly namera?: { readonly type?: unknown } } | undefined
  const type = extend?.namera?.type
  return { type: type === "kernel" ? type : "unknown" }
}

// The implementation's methods are called by viem (when sending, signing or estimating); their failures come out as
// Namera's errors: a signing method's as `AccountError` (`SigningFailed`), a viem or ox error from any other method as
// a `ChainError`. Namera's own errors pass through.
const translated = <Implementation extends SmartAccountImplementation>(
  implementation: Implementation
): Implementation => {
  const account = accountOf(implementation)
  const chain = (cause: unknown) =>
    isNameraError(cause) || !isForeign(cause) ? cause : fromUnknown(cause, context(implementation.client, "account"))
  const signing = (cause: unknown) => isNameraError(cause) ? cause : AccountError.signingFailed({ account, cause })
  const wrap = <F extends ((...args: Array<never>) => unknown) | undefined>(
    method: F,
    translate: (cause: unknown) => unknown
  ): F =>
    (method === undefined ? undefined : (...args: Array<never>) =>
      Promise.resolve()
        .then(() => method(...args))
        .catch((cause: unknown) => Promise.reject(translate(cause)))) as F

  return {
    ...implementation,
    getAddress: wrap(implementation.getAddress, chain),
    decodeCalls: wrap(implementation.decodeCalls, chain),
    encodeCalls: wrap(implementation.encodeCalls, chain),
    getFactoryArgs: wrap(implementation.getFactoryArgs, chain),
    getNonce: wrap(implementation.getNonce, chain),
    getStubSignature: wrap(implementation.getStubSignature, chain),
    sign: wrap(implementation.sign, signing),
    signMessage: wrap(implementation.signMessage, signing),
    signTypedData: wrap(implementation.signTypedData, signing),
    signUserOperation: wrap(implementation.signUserOperation, signing)
  }
}

/**
 * Builds viem's smart account from an implementation (viem's `toSmartAccount` options), with the implementation's
 * failures translated to Namera's errors.
 *
 * @internal
 */
export const from = <const Implementation extends SmartAccountImplementation>(
  implementation: Implementation
): Effect.Effect<SmartAccount<Implementation>, AccountError.AccountError | ChainError.ChainError> =>
  Effect.tryPromise({
    try: () => build(translated(implementation)) as Promise<SmartAccount<Implementation>>,
    catch: (cause) =>
      AccountError.isAccountError(cause) || isNameraError(cause)
        ? (cause as AccountError.AccountError | ChainError.ChainError)
        : AccountError.invalidOptions({
          account: accountOf(implementation),
          detail: "viem could not build the account",
          cause
        })
  }).pipe(
    Effect.tap(() => annotate({ chainId: chainIdsOf(implementation.client) })),
    traced("Namera.SmartAccount.from")
  )

/**
 * Everything that differs between the ways to build an account (key or passkey owner, deployed or EIP-7702); `define`
 * turns it into a viem implementation and builds it.
 *
 * @internal
 */
export interface Definition<Type extends Metadata["type"]> {
  readonly metadata: Metadata<Type>
  readonly client: ChainClient
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
 * Builds a Namera account from its definition through `from`. viem calls the methods as Promises, so each runs
 * through the Promise boundary and rejects with the same error the Effect form fails with.
 *
 * @internal
 */
export const define = <Type extends Metadata["type"]>(
  definition: Definition<Type>
): Effect.Effect<NameraSmartAccount<Type>, AccountError.AccountError | ChainError.ChainError> => {
  const { address, client } = definition
  const isDeployed = code(client, address).pipe(Effect.map((code) => code !== undefined))

  return from({
    client,
    entryPoint,
    extend: { namera: definition.metadata },
    ...(definition.authorization === undefined ? {} : { authorization: definition.authorization }),
    getAddress: () => Promise.resolve(address),
    getFactoryArgs: () =>
      Promise.resolve(
        definition.factory === undefined
          ? { factory: undefined, factoryData: undefined }
          : { factory: definition.factory.address, factoryData: definition.factory.data }
      ),
    // The owner always uses its own nonce lane; viem's per-call nonce keys would land on another validator.
    getNonce: () => run(nonce(client, address, definition.nonceKey)),
    encodeCalls: (calls: ReadonlyArray<Call>) =>
      definition.firstCalls === undefined
        ? Promise.resolve(definition.encodeCalls(calls))
        : run(isDeployed.pipe(Effect.map((deployed) =>
          definition.encodeCalls(deployed ? calls : [...definition.firstCalls!, ...calls])
        ))),
    getStubSignature: () => Promise.resolve(definition.stubSignature),
    signMessage: ({ message }: { message: SignableMessage }) => run(definition.signMessage(message)),
    signTypedData: (typedData: TypedDataDefinition) => run(definition.signTypedData(typedData)),
    signUserOperation: (userOperation: Parameters<SmartAccountImplementation["signUserOperation"]>[0]) =>
      run(definition.signUserOperationHash(
        userOperationHash({ userOperation, sender: address, chainId: client.chain.id })
      ))
  } as SmartAccountImplementation<EntryPointAbi, "0.7", { readonly namera: Metadata<Type> }>) as Effect.Effect<
    NameraSmartAccount<Type>,
    AccountError.AccountError | ChainError.ChainError
  >
}
