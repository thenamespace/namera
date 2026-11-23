import { assert } from "@effect/vitest"
import { KernelAccount, NexusAccount, Safe7579Account, Session, SmartAccount } from "@namera-ai/sdk"
import * as Effect_ from "@namera-ai/sdk/effect"
import { Effect } from "effect"
import { createClient, http, zeroAddress } from "viem"
import { entryPoint07Abi, entryPoint07Address } from "viem/account-abstraction"

import { client, newOwner } from "../accounts/accounts.test-utils.ts"

/** A call in both forms: the Promise one takes the abort signal. */
interface Call {
  readonly promise: (signal?: AbortSignal) => Promise<unknown>
  readonly effect: () => Effect.Effect<unknown, unknown>
}

/**
 * How the Promise and Effect forms of an export agree, for every export whose two forms are not the same value.
 * Exports that are the same value in both entries (error classes, pure functions) need no row.
 */
export type Conformance =
  | {
    /** The function has no Promise: both forms return the same value, one directly and one from an Effect. */
    readonly kind: "sync"
    readonly check: () => Promise<void>
  }
  | {
    /** An asynchronous function: both forms fail the same way, and the Promise form honours its abort signal. */
    readonly kind: "async"
    readonly failure: Call
    /** When cheap enough to run twice: both forms succeed with the same value, compared through `project`. */
    readonly success?: Call & { readonly project?: (value: unknown) => unknown }
  }

// A client on the test chain without a chain configured, and one whose node can't be reached.
const chainless = createClient({ transport: http(client.transport.url) })
const unreachable = createClient({ chain: client.chain, transport: http("http://127.0.0.1:1", { retryCount: 0 }) })
const owner = newOwner()
// A custom implementation whose address resolves (or fails) as given; nothing else is called while building it.
const implementation = (address: Promise<`0x${string}`>): SmartAccount.Implementation => {
  // Settled before use, so a rejected address never counts as unhandled.
  address.catch(() => undefined)
  return {
    client,
    entryPoint: { abi: entryPoint07Abi, address: entryPoint07Address, version: "0.7" },
    getAddress: () => address,
    encodeCalls: () => Promise.resolve("0x"),
    getFactoryArgs: () => Promise.resolve({ factory: undefined, factoryData: undefined }),
    getStubSignature: () => Promise.resolve("0x"),
    signMessage: () => Promise.resolve("0x"),
    signTypedData: () => Promise.resolve("0x"),
    signUserOperation: () => Promise.resolve("0x")
  }
}
const account = (value: unknown) => {
  const { address, namera } = value as KernelAccount.KernelAccount
  return { address, namera }
}

export const table: Record<string, Conformance> = {
  "Session.now": {
    kind: "sync",
    check: async () => {
      const promise = Session.now()
      const effect = await Effect.runPromise(Effect_.Session.now())
      assert.isAtMost(Math.abs(effect - promise), 1)
    }
  },
  "SmartAccount.from": {
    kind: "async",
    success: {
      promise: (signal) => SmartAccount.from(implementation(Promise.resolve(zeroAddress)), { signal }),
      effect: () => Effect_.SmartAccount.from(implementation(Promise.resolve(zeroAddress))),
      project: (value) => (value as { readonly address: string }).address
    },
    failure: {
      promise: (signal) => SmartAccount.from(implementation(Promise.reject(new Error("no address"))), { signal }),
      effect: () => Effect_.SmartAccount.from(implementation(Promise.reject(new Error("no address"))))
    }
  },
  "SmartAccount.detect": {
    kind: "async",
    success: {
      promise: (signal) => SmartAccount.detect(client, { address: zeroAddress, signal }),
      effect: () => Effect_.SmartAccount.detect(client, { address: zeroAddress })
    },
    failure: {
      promise: (signal) => SmartAccount.detect(unreachable, { address: zeroAddress, signal }),
      effect: () => Effect_.SmartAccount.detect(unreachable, { address: zeroAddress })
    }
  },
  "SmartAccount.fromAddress": {
    kind: "async",
    failure: {
      promise: (signal) => SmartAccount.fromAddress({ client, address: zeroAddress, owner, signal }),
      effect: () => Effect_.SmartAccount.fromAddress({ client, address: zeroAddress, owner })
    }
  },
  "SmartAccount.isSessionsInstalled": {
    kind: "async",
    success: {
      promise: (signal) => SmartAccount.isSessionsInstalled(client, { address: zeroAddress, signal }),
      effect: () => Effect_.SmartAccount.isSessionsInstalled(client, { address: zeroAddress })
    },
    failure: {
      promise: (signal) => SmartAccount.isSessionsInstalled(unreachable, { address: zeroAddress, signal }),
      effect: () => Effect_.SmartAccount.isSessionsInstalled(unreachable, { address: zeroAddress })
    }
  },
  "SmartAccount.installSessions": {
    kind: "async",
    failure: {
      promise: (signal) => SmartAccount.installSessions(client, { signal }),
      effect: () => Effect_.SmartAccount.installSessions(client)
    }
  },
  "SmartAccount.installSessionsSync": {
    kind: "async",
    failure: {
      promise: (signal) => SmartAccount.installSessionsSync(client, { signal }),
      effect: () => Effect_.SmartAccount.installSessionsSync(client)
    }
  },
  "KernelAccount.from": {
    kind: "async",
    success: {
      promise: (signal) => KernelAccount.from({ client, owner, signal }),
      effect: () => Effect_.KernelAccount.from({ client, owner }),
      project: account
    },
    failure: {
      promise: (signal) => KernelAccount.from({ client: chainless, owner, signal }),
      effect: () => Effect_.KernelAccount.from({ client: chainless, owner })
    }
  },
  "KernelAccount.fromEip7702": {
    kind: "async",
    success: {
      promise: (signal) => KernelAccount.fromEip7702({ client, owner, signal }),
      effect: () => Effect_.KernelAccount.fromEip7702({ client, owner }),
      project: account
    },
    failure: {
      promise: (signal) => KernelAccount.fromEip7702({ client: chainless, owner, signal }),
      effect: () => Effect_.KernelAccount.fromEip7702({ client: chainless, owner })
    }
  },
  "NexusAccount.from": {
    kind: "async",
    success: {
      promise: (signal) => NexusAccount.from({ client, owner, signal }),
      effect: () => Effect_.NexusAccount.from({ client, owner }),
      project: account
    },
    failure: {
      promise: (signal) => NexusAccount.from({ client: chainless, owner, signal }),
      effect: () => Effect_.NexusAccount.from({ client: chainless, owner })
    }
  },
  "NexusAccount.fromEip7702": {
    kind: "async",
    success: {
      promise: (signal) => NexusAccount.fromEip7702({ client, owner, signal }),
      effect: () => Effect_.NexusAccount.fromEip7702({ client, owner }),
      project: account
    },
    failure: {
      promise: (signal) => NexusAccount.fromEip7702({ client: chainless, owner, signal }),
      effect: () => Effect_.NexusAccount.fromEip7702({ client: chainless, owner })
    }
  },
  "Safe7579Account.from": {
    kind: "async",
    success: {
      promise: (signal) => Safe7579Account.from({ client, owners: [owner], signal }),
      effect: () => Effect_.Safe7579Account.from({ client, owners: [owner] }),
      project: account
    },
    failure: {
      promise: (signal) => Safe7579Account.from({ client, owners: [owner], threshold: 2, signal }),
      effect: () => Effect_.Safe7579Account.from({ client, owners: [owner], threshold: 2 })
    }
  }
}
