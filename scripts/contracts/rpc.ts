import * as Effect from "effect/Effect"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as HttpClientResponse from "effect/http/HttpClientResponse"
import * as Schema from "effect/Schema"

import { RpcFailed } from "../errors.ts"
import { Hex, TransactionReceipt } from "./schema.ts"

const call = Effect.fnUntraced(function*<S extends Schema.Codec<unknown, unknown>>(
  url: string,
  method: string,
  params: ReadonlyArray<unknown>,
  result: S
) {
  const client = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk)
  const failed = (message: string) => RpcFailed.make({ url, method, message })

  const response = yield* HttpClientRequest.post(url).pipe(
    HttpClientRequest.bodyJsonUnsafe({ jsonrpc: "2.0", id: 1, method, params }),
    client.execute,
    Effect.flatMap(
      HttpClientResponse.schemaBodyJson(
        Schema.Struct({
          result: Schema.optionalKey(Schema.Unknown),
          error: Schema.optionalKey(Schema.Struct({ message: Schema.String }))
        })
      )
    ),
    Effect.mapError((cause) => failed(String(cause)))
  )
  if (response.error !== undefined) return yield* failed(response.error.message)

  return yield* Schema.decodeUnknownEffect(result)(response.result).pipe(
    Effect.mapError((cause) => failed(String(cause)))
  )
})

/** The chain id the node at `url` serves. */
export const chainId = (url: string) => call(url, "eth_chainId", [], Hex).pipe(Effect.map((id) => Number(id)))

/** The runtime code at `address`, `0x` when there is none. */
export const code = (url: string, address: string) => call(url, "eth_getCode", [address, "latest"], Hex)

/** The receipt of `transactionHash`, or `null` while it is unknown to the node. */
export const receipt = (url: string, transactionHash: string) =>
  call(url, "eth_getTransactionReceipt", [transactionHash], Schema.NullOr(TransactionReceipt))
