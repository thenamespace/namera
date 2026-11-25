import type * as ChainError from "../../ChainError.ts"
import type * as GrantError from "../../GrantError.ts"
import type * as core from "../core/grant/grant.ts"
import { canonical } from "../core/session/session.ts"
import { run } from "../promise.ts"
import { type ReadClient, watchBlocks } from "../viem/client.ts"
import { getStatus, type Status } from "./status.ts"

// Watching a grant: its status read on every new block of the first client's chain, reported when it changes. A watch
// is a runtime boundary like the Promise API, so it runs the status read itself.

/**
 * A running watch: `off()` stops it.
 */
export interface Watcher {
  readonly off: () => void
}

/**
 * Calls `onChange` with the grant's status now and whenever it changes, read on each new block; `onError` with a read
 * that failed (the watch goes on).
 *
 * @internal
 */
export const watchStatus = (
  clients: ReadonlyArray<ReadClient>,
  options: {
    readonly grant: core.Grant
    readonly onChange: (status: Status) => void
    readonly onError?: ((error: ChainError.ChainError | GrantError.GrantError) => void) | undefined
    readonly pollingInterval?: number | undefined
  }
): Watcher => {
  let previous: string | undefined
  let reading = false
  let again = false
  let stopped = false
  const read = () => {
    // A block that arrives while the last one is being read is read right after it.
    if (reading) {
      again = true
      return
    }
    reading = true
    const done = () => {
      reading = false
      if (again && !stopped) {
        again = false
        read()
      }
    }
    run(getStatus(clients, options.grant)).then(
      (status) => {
        const key = canonical(status)
        if (!stopped && key !== previous) {
          previous = key
          options.onChange(status)
        }
        done()
      },
      (error: ChainError.ChainError | GrantError.GrantError) => {
        if (!stopped) options.onError?.(error)
        done()
      }
    )
  }
  const unwatch = watchBlocks(clients[0]!, {
    onBlock: read,
    onError: (error) => options.onError?.(error),
    pollingInterval: options.pollingInterval
  })
  return {
    off: () => {
      stopped = true
      unwatch()
    }
  }
}
