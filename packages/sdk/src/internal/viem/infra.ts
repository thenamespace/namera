// viem's pieces the bundler and paymaster helpers are built from: HTTP transports to vendor endpoints, the ERC-7677
// paymaster actions, and the node's fee estimate.
import type { Chain, Client, EIP1193RequestFn, HttpTransportConfig, Transport } from "viem"
import { createClient, http } from "viem"
import {
  getPaymasterData as viemGetPaymasterData,
  type GetPaymasterDataParameters,
  type GetPaymasterDataReturnType,
  getPaymasterStubData as viemGetPaymasterStubData,
  type GetPaymasterStubDataParameters,
  type GetPaymasterStubDataReturnType,
  type UserOperationRequest
} from "viem/account-abstraction"
import { estimateFeesPerGas } from "viem/actions"

/**
 * viem's types the helpers' public signatures use.
 */
export type {
  Chain,
  Client,
  GetPaymasterDataParameters,
  GetPaymasterDataReturnType,
  GetPaymasterStubDataParameters,
  GetPaymasterStubDataReturnType,
  HttpTransportConfig,
  Transport,
  UserOperationRequest
}

/**
 * An HTTP transport to a vendor's endpoint, built for the client's chain. Failures go through `translate` (which
 * keeps the endpoint's credentials out of them), and `result` may adjust what the endpoint answered.
 *
 * @internal
 */
export const vendorTransport = (options: {
  readonly url: (chain: Chain | undefined) => string
  readonly http?: HttpTransportConfig | undefined
  readonly headers?: Readonly<Record<string, string>> | undefined
  readonly translate: (error: unknown, method: string, url: string) => unknown
  readonly result?: ((method: string, params: unknown, result: unknown) => unknown) | undefined
}): Transport =>
(parameters) => {
  const url = options.url(parameters.chain)
  const fetchOptions = options.http?.fetchOptions
  const base = http(url, {
    ...options.http,
    fetchOptions: {
      ...fetchOptions,
      headers: { ...(fetchOptions?.headers as Record<string, string> | undefined), ...options.headers }
    }
  })(parameters)
  const request = (async (args, requestOptions) => {
    let result: unknown
    try {
      result = await base.request(args, requestOptions)
    } catch (error) {
      throw options.translate(error, args.method, url)
    }
    return options.result === undefined ? result : options.result(args.method, args.params, result)
  }) as EIP1193RequestFn
  return { ...base, request }
}

/**
 * A client for a paymaster's endpoint.
 *
 * @internal
 */
export const paymasterClient = (transport: Transport): Client => createClient({ transport })

/**
 * ERC-7677's `pm_getPaymasterStubData`: gas fields the operation doesn't have yet are sent as zero, and only the
 * paymaster's fields come back.
 *
 * @internal
 */
export const getPaymasterStubData = (
  client: Client,
  parameters: GetPaymasterStubDataParameters
): Promise<GetPaymasterStubDataReturnType> => viemGetPaymasterStubData(client, parameters)

/**
 * ERC-7677's `pm_getPaymasterData`: only the paymaster's fields come back.
 *
 * @internal
 */
export const getPaymasterData = (
  client: Client,
  parameters: GetPaymasterDataParameters
): Promise<GetPaymasterDataReturnType> => viemGetPaymasterData(client, parameters)

/**
 * The node's EIP-1559 fees, doubled as viem's bundler client does without a fee hook: bundlers check fees strictly.
 *
 * @internal
 */
export const nodeFees = async (
  client: Client
): Promise<{ readonly maxFeePerGas: bigint; readonly maxPriorityFeePerGas: bigint }> => {
  const fees = await estimateFeesPerGas(client, { chain: client.chain, type: "eip1559" })
  return { maxFeePerGas: BigInt(2) * fees.maxFeePerGas, maxPriorityFeePerGas: BigInt(2) * fees.maxPriorityFeePerGas }
}
