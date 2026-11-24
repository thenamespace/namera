import * as Effect from "effect/Effect"
import type * as Hex from "ox/Hex"

import type * as ChainError from "../../ChainError.ts"
import type * as GrantError from "../../GrantError.ts"
import { laneOf } from "../core/agent/nonce.ts"
import { signaturePermissionId } from "../core/grant/enable.ts"
import * as core from "../core/grant/grant.ts"
import { decodeUserOperationEvent, operationSignature, userOperationTopics } from "../core/grant/history.ts"
import { blockNumber, logs, type ReadClient, transactionInput } from "../viem/client.ts"
import { entryPoint } from "../viem/smartAccount.ts"
import { chainOf } from "./status.ts"

// The operations an agent sent under a grant: the EntryPoint's logs for the account, kept when the nonce key routes
// through Smart Sessions and the operation's signature names the grant's session. Logs are read in pages, since RPCs
// limit the block range of `eth_getLogs`.

/**
 * One operation sent under a grant.
 *
 * @internal
 */
export interface Operation {
  readonly chain: `eip155:${number}`
  readonly userOpHash: Hex.Hex
  readonly transactionHash: Hex.Hex
  readonly blockNumber: bigint
  readonly success: boolean
  readonly actualGasCost: bigint
  readonly actualGasUsed: bigint
  readonly lane: number
  /** `enable` for the operation that enabled the session (ENABLE mode), `use` for the others. */
  readonly mode: "enable" | "use"
}

/**
 * The operations sent under the grant on the client's chain from `fromBlock` (0 by default) to `toBlock` (the latest
 * by default), oldest first, reading `pageSize` blocks of logs at a time (10,000 by default).
 *
 * @internal
 */
export const getUsage = Effect.fnUntraced(function*(
  client: ReadClient,
  options: {
    readonly grant: core.Grant
    readonly fromBlock?: bigint | undefined
    readonly toBlock?: bigint | undefined
    readonly pageSize?: bigint | undefined
  }
): Effect.fn.Return<ReadonlyArray<Operation>, ChainError.ChainError | GrantError.GrantError> {
  const { grant } = options
  const chain = yield* chainOf(client, grant)
  const account = core.accountAddress(grant)
  const smartSession = chain.contracts.smartSession
  const last = options.toBlock ?? (yield* blockNumber(client))
  const pageSize = options.pageSize ?? BigInt(10_000)

  const operations: Array<Operation> = []
  const inputs = new Map<Hex.Hex, Hex.Hex>()
  for (let from = options.fromBlock ?? BigInt(0); from <= last; from += pageSize) {
    const to = from + pageSize - BigInt(1) < last ? from + pageSize - BigInt(1) : last
    const page = yield* logs(client, {
      address: entryPoint.address,
      topics: userOperationTopics(account),
      fromBlock: from,
      toBlock: to
    })
    for (const log of page) {
      const event = decodeUserOperationEvent(log)
      const lane = laneOf(smartSession, event.nonce >> BigInt(64))
      if (lane === undefined) continue
      let input = inputs.get(log.transactionHash)
      if (input === undefined) {
        input = yield* transactionInput(client, log.transactionHash)
        inputs.set(log.transactionHash, input)
      }
      const signature = operationSignature(input, account, event.nonce)
      const signed = signature === undefined ? undefined : signaturePermissionId(signature)
      if (signed === undefined || signed.permissionId.toLowerCase() !== grant.id.toLowerCase()) continue
      operations.push({
        chain: chain.chain,
        userOpHash: event.userOpHash,
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
        success: event.success,
        actualGasCost: event.actualGasCost,
        actualGasUsed: event.actualGasUsed,
        lane,
        mode: signed.mode
      })
    }
  }
  return operations
})
