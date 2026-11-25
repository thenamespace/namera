import * as Predicate from "effect/Predicate"
import * as Result from "effect/Result"
import * as Address from "ox/Address"
import * as Hex from "ox/Hex"

import type { Call } from "../core/account/erc7579.ts"
import type { RpcUserOperationReceipt } from "../viem/provider.ts"
import { codes, make, type ProviderRpcError } from "./providerError.ts"

// EIP-5792 (wallet call API, version 2.0.0, as viem 2 implements it) over one user operation per batch: a batch's calls
// run in one operation, so they are always atomic, and the batch's id is the operation's hash unless the app names one.

/**
 * The capabilities the provider reports for its chain.
 *
 * @internal
 */
export const capabilities = {
  atomic: { status: "supported" },
  paymasterService: { supported: true }
} as const

/**
 * An ERC-7677 paymaster service named in a batch's capabilities.
 *
 * @internal
 */
export interface PaymasterService {
  readonly url: string
  readonly context?: unknown
}

/**
 * A `wallet_sendCalls` request, checked.
 *
 * @internal
 */
export interface SendCalls {
  readonly id: string | undefined
  readonly calls: ReadonlyArray<Call>
  readonly paymasterService: PaymasterService | undefined
}

const invalid = (message: string) => Result.fail(make(codes.invalidParams, message))

const isOptional = (capability: unknown) =>
  Predicate.hasProperty(capability, "optional") && capability.optional === true

/** The capabilities a request names, with every non-optional one that isn't `paymasterService` refused. */
const checkCapabilities = (
  given: unknown,
  where: string
): Result.Result<PaymasterService | undefined, ProviderRpcError> => {
  if (given === undefined || given === null) return Result.succeed(undefined)
  if (!Predicate.isObject(given)) return invalid(`${where}'s capabilities must be an object`)

  let paymasterService: PaymasterService | undefined
  for (const [name, capability] of Object.entries(given)) {
    if (name === "paymasterService" && where === "the batch") {
      if (!Predicate.hasProperty(capability, "url") || !Predicate.isString(capability.url)) {
        return invalid("paymasterService needs a url")
      }
      paymasterService = {
        url: capability.url,
        ...(Predicate.hasProperty(capability, "context") ? { context: capability.context } : {})
      }
      continue
    }
    if (!isOptional(capability)) {
      return Result.fail(make(codes.unsupportedCapability, `the ${name} capability is not supported on ${where}`))
    }
  }
  return Result.succeed(paymasterService)
}

const quantity = (value: unknown): bigint | undefined => {
  if (value === undefined || value === null) return BigInt(0)
  if (!Predicate.isString(value) || !Hex.validate(value)) return undefined
  return value === "0x" ? BigInt(0) : Hex.toBigInt(value)
}

const checkCall = (call: unknown, index: number): Result.Result<Call, ProviderRpcError> => {
  if (!Predicate.isObject(call)) return invalid(`call ${index} must be an object`)
  const { data, to, value } = call as { readonly to?: unknown; readonly data?: unknown; readonly value?: unknown }
  // A user operation calls from the account: there is no contract creation without a target.
  if (!Predicate.isString(to) || !Address.validate(to, { strict: false })) {
    return invalid(`call ${index} needs a "to" address`)
  }
  if (data !== undefined && data !== null && (!Predicate.isString(data) || !Hex.validate(data))) {
    return invalid(`call ${index}'s data must be hex`)
  }
  const wei = quantity(value)
  if (wei === undefined) return invalid(`call ${index}'s value must be a hex quantity`)
  const checked = checkCapabilities((call as { readonly capabilities?: unknown }).capabilities, `call ${index}`)
  if (Result.isFailure(checked)) return Result.fail(checked.failure)
  return Result.succeed({ to: to as Hex.Hex, value: wei, data: (data ?? "0x") as Hex.Hex })
}

/**
 * Checks a `wallet_sendCalls` request for the provider's account and chain: version 2, the account as `from`, the
 * chain as `chainId`, at least one call, and no capability it can't honour unless optional. `atomicRequired` is
 * honoured either way.
 *
 * @internal
 */
export const parseSendCalls = (
  params: unknown,
  options: { readonly chainId: number; readonly address: Hex.Hex }
): Result.Result<SendCalls, ProviderRpcError> => {
  const request = Array.isArray(params) ? params[0] : undefined
  if (!Predicate.isObject(request)) return invalid("wallet_sendCalls takes one request object")
  const { atomicRequired, calls, chainId, from, id, version } = request as Record<string, unknown>

  if (!Predicate.isString(version) || version.split(".")[0] !== "2") {
    return invalid(`wallet_sendCalls version ${String(version)} is not supported: use 2.0.0`)
  }
  if (from !== undefined && from !== null) {
    if (!Predicate.isString(from) || !Address.validate(from, { strict: false })) {
      return invalid("from must be an address")
    }
    if (!Address.isEqual(from, options.address)) {
      return Result.fail(make(codes.unauthorized, `${from} is not this provider's account`))
    }
  }
  if (chainId !== undefined && chainId !== null) {
    if (!Predicate.isString(chainId) || !Hex.validate(chainId)) return invalid("chainId must be a hex quantity")
    if (Hex.toNumber(chainId) !== options.chainId) {
      return Result.fail(make(codes.unsupportedChain, `chain ${Hex.toNumber(chainId)} is not this provider's chain`))
    }
  }
  if (atomicRequired !== undefined && !Predicate.isBoolean(atomicRequired)) {
    return invalid("atomicRequired must be a boolean")
  }
  if (id !== undefined && id !== null && (!Predicate.isString(id) || id.length === 0 || id.length > 4096)) {
    return invalid("id must be a string of 1 to 4096 characters")
  }
  if (!Array.isArray(calls) || calls.length === 0) return invalid("wallet_sendCalls needs at least one call")

  const checked: Array<Call> = []
  for (const [index, call] of calls.entries()) {
    const result = checkCall(call, index)
    if (Result.isFailure(result)) return Result.fail(result.failure)
    checked.push(result.success)
  }
  const paymasterService = checkCapabilities(request.capabilities, "the batch")
  if (Result.isFailure(paymasterService)) return Result.fail(paymasterService.failure)
  return Result.succeed({
    id: Predicate.isString(id) ? id : undefined,
    calls: checked,
    paymasterService: paymasterService.success
  })
}

/**
 * EIP-5792's status codes as the provider reads a user operation.
 *
 * @internal
 */
export const status = {
  /** No receipt yet, and the operation's nonce is still unused. */
  pending: 100,
  /** Included, and its calls succeeded. */
  confirmed: 200,
  /** Never included, and never will be: another operation used its nonce. */
  dropped: 400,
  /** Included, and its calls reverted: an operation's calls are atomic, so only the gas charge changed state. */
  reverted: 500
} as const

/**
 * A `wallet_getCallsStatus` answer.
 *
 * @internal
 */
export const callsStatus = (options: {
  readonly id: string
  readonly chainId: number
  readonly status: number
  readonly receipt?: RpcUserOperationReceipt<"0.7"> | undefined
}) => ({
  version: "2.0.0",
  id: options.id,
  chainId: Hex.fromNumber(options.chainId),
  status: options.status,
  atomic: true,
  // The operation's own logs and gas, in the transaction that included it.
  ...(options.receipt === undefined ? {} : {
    receipts: [{
      logs: options.receipt.logs.map(({ address, data, topics }) => ({ address, data, topics })),
      status: options.receipt.success ? "0x1" : "0x0",
      blockHash: options.receipt.receipt.blockHash,
      blockNumber: options.receipt.receipt.blockNumber,
      gasUsed: options.receipt.actualGasUsed,
      transactionHash: options.receipt.receipt.transactionHash
    }]
  })
})
