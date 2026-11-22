import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"

import type * as ChainError from "../ChainError.ts"
import { fromUnknown, invalidResponse } from "./chainError.ts"

/**
 * The part of a client Namera uses: `request`, `chain` and `account`. viem v2 clients and viem v3 clients both
 * satisfy it, so network functions take either.
 *
 * @internal
 */
export interface Client {
  // Method syntax keeps the parameter bivariant, so viem's generic, method-typed `request` is assignable.
  request(args: { readonly method: string; readonly params?: unknown }): Promise<unknown>
  readonly chain?: { readonly id: number } | undefined
  readonly account?: { readonly address: `0x${string}` } | undefined
}

/**
 * Sends one JSON-RPC request through the client, translating any failure into a `ChainError`.
 *
 * @internal
 */
export const request = (
  client: Client,
  args: { readonly method: string; readonly params?: unknown }
): Effect.Effect<unknown, ChainError.ChainError> =>
  Effect.tryPromise({ try: () => client.request(args), catch: (error) => fromUnknown(error, args.method) })

const Quantity = Schema.TemplateLiteral(["0x", Schema.String]).check(Schema.isPattern(/^0x(0|[1-9a-f][0-9a-f]*)$/i))

/**
 * Returns the id of the chain the client is connected to, read from the node.
 *
 * @internal
 */
export const getChainId: (client: Client) => Effect.Effect<number, ChainError.ChainError> = Effect.fnUntraced(
  function*(client: Client) {
    const result = yield* request(client, { method: "eth_chainId" })
    const quantity = yield* Schema.decodeUnknownEffect(Quantity)(result).pipe(
      Effect.mapError((cause) => invalidResponse("eth_chainId", cause))
    )
    return Number(quantity)
  }
)
