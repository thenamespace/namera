import { assert } from "@effect/vitest"
import {
  KernelAccount,
  Key,
  Keystore,
  NexusAccount,
  Safe7579Account,
  Session,
  SessionKey,
  SmartAccount
} from "@namera-ai/sdk"
import * as Effect_ from "@namera-ai/sdk/effect"
import { Effect, Exit } from "effect"
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

// Key stores the Promise and Effect forms share: a store is the same value in both APIs.
const memory = Keystore.memory()
const secp256k1Only = Keystore.from({
  curves: ["secp256k1"],
  create: () => Promise.reject(new Error("unused")),
  get: () => Promise.reject(new Error("unused")),
  list: () => Promise.reject(new Error("backend offline")),
  remove: () => Promise.reject(new Error("unused")),
  sign: () => Promise.reject(new Error("unused"))
})
const digest = `0x${"11".repeat(32)}` as const
const devKey = {
  id: "dev",
  label: undefined,
  curve: "secp256k1",
  publicKey:
    "0x048318535b54105d4a7aae60c08fc45f9687181b4fdfc625bd1a753fa7397fed753547f11ca8696646f2f3acb08e31016afac23e630c5d11f59f61fef57b0d2aa5",
  createdAt: 0
} as const

export const table: Record<string, Conformance> = {
  "Key.address": {
    kind: "sync",
    check: async () => {
      assert.strictEqual(Key.address(devKey, "eip155"), await Effect.runPromise(Effect_.Key.address(devKey, "eip155")))
    }
  },
  "Key.caip10": {
    kind: "sync",
    check: async () => {
      assert.strictEqual(
        Key.caip10(devKey, "eip155:1"),
        await Effect.runPromise(Effect_.Key.caip10(devKey, "eip155:1"))
      )
    }
  },
  "SessionKey.ecdsa": {
    kind: "sync",
    check: async () => {
      const agent = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
      assert.deepStrictEqual(SessionKey.ecdsa(agent), await Effect.runPromise(Effect_.SessionKey.ecdsa(agent)))
      assert.throws(() => SessionKey.ecdsa("0x1234"))
      assert.isTrue(Exit.isFailure(await Effect.runPromiseExit(Effect_.SessionKey.ecdsa("0x1234"))))
    }
  },
  "SessionKey.ecdsaThreshold": {
    kind: "sync",
    check: async () => {
      const options = {
        threshold: 1,
        signers: ["0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"]
      }
      assert.deepStrictEqual(
        SessionKey.ecdsaThreshold(options),
        await Effect.runPromise(Effect_.SessionKey.ecdsaThreshold(options))
      )
      assert.throws(() => SessionKey.ecdsaThreshold({ threshold: 0, signers: options.signers }))
    }
  },
  "Keystore.encryptedJson": {
    kind: "sync",
    check: async () => {
      const promise = Keystore.encryptedJson({ password: "p" })
      const effect = await Effect.runPromise(Effect_.Keystore.encryptedJson({ password: "p" }))
      assert.strictEqual(promise.type, effect.type)
      assert.throws(() => Keystore.encryptedJson({ password: "p", data: "{}" }))
      assert.isTrue(
        Exit.isFailure(await Effect.runPromiseExit(Effect_.Keystore.encryptedJson({ password: "p", data: "{}" })))
      )
    }
  },
  "Keystore.from": {
    kind: "sync",
    check: async () => {
      const effect = Effect_.Keystore.from({
        curves: ["secp256k1"],
        create: () => Effect.die("unused"),
        get: () => Effect.die("unused"),
        list: Effect.succeed([]),
        remove: () => Effect.die("unused"),
        sign: () => Effect.die("unused")
      })
      assert.strictEqual(effect.type, secp256k1Only.type)
      assert.deepStrictEqual(await Effect.runPromise(Effect_.Keystore.list(effect)), [])
    }
  },
  "Keystore.create": {
    kind: "async",
    failure: {
      promise: (signal) => Keystore.create(secp256k1Only, { curve: "p256", signal }),
      effect: () => Effect_.Keystore.create(secp256k1Only, { curve: "p256" })
    }
  },
  "Keystore.get": {
    kind: "async",
    failure: {
      promise: (signal) => Keystore.get(memory, { id: "missing", signal }),
      effect: () => Effect_.Keystore.get(memory, { id: "missing" })
    }
  },
  "Keystore.list": {
    kind: "async",
    success: {
      promise: (signal) => Keystore.list(memory, { signal }),
      effect: () => Effect_.Keystore.list(memory)
    },
    failure: {
      promise: (signal) => Keystore.list(secp256k1Only, { signal }),
      effect: () => Effect_.Keystore.list(secp256k1Only)
    }
  },
  "Keystore.remove": {
    kind: "async",
    failure: {
      promise: (signal) => Keystore.remove(memory, { id: "missing", signal }),
      effect: () => Effect_.Keystore.remove(memory, { id: "missing" })
    }
  },
  "Keystore.sign": {
    kind: "async",
    failure: {
      promise: (signal) => Keystore.sign(memory, { id: "missing", digest, signal }),
      effect: () => Effect_.Keystore.sign(memory, { id: "missing", digest })
    }
  },
  "Keystore.toAccount": {
    kind: "async",
    failure: {
      promise: (signal) => Keystore.toAccount(memory, { id: "missing", signal }),
      effect: () => Effect_.Keystore.toAccount(memory, { id: "missing" })
    }
  },
  "Keystore.toJson": {
    kind: "async",
    failure: {
      promise: (signal) => Keystore.toJson(memory, { signal }),
      effect: () => Effect_.Keystore.toJson(memory)
    }
  },
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
  "SmartAccount.signUserOperations": {
    kind: "async",
    failure: {
      promise: async (signal) =>
        SmartAccount.signUserOperations({
          userOperations: [{ account: await KernelAccount.from({ client, owner }), userOperation: {} }],
          signal
        }),
      effect: () =>
        Effect.promise(() => KernelAccount.from({ client, owner })).pipe(
          Effect.flatMap((account) =>
            Effect_.SmartAccount.signUserOperations({ userOperations: [{ account, userOperation: {} }] })
          )
        )
    }
  },
  "SmartAccount.getMultichainStubSignature": {
    kind: "async",
    failure: {
      promise: async (signal) =>
        SmartAccount.getMultichainStubSignature(await KernelAccount.from({ client, owner }), { count: 2, signal }),
      effect: () =>
        Effect.promise(() => KernelAccount.from({ client, owner })).pipe(
          Effect.flatMap((account) => Effect_.SmartAccount.getMultichainStubSignature(account, { count: 2 }))
        )
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
  "SmartAccount.addOwnerCalls": {
    kind: "async",
    failure: {
      promise: async (signal) =>
        SmartAccount.addOwnerCalls(await KernelAccount.from({ client, owner }), { owner: zeroAddress, signal }),
      effect: () =>
        Effect.promise(() => KernelAccount.from({ client, owner })).pipe(
          Effect.flatMap((account) => Effect_.SmartAccount.addOwnerCalls(account, { owner: zeroAddress }))
        )
    }
  },
  "SmartAccount.addOwner": {
    kind: "async",
    failure: {
      promise: (signal) => SmartAccount.addOwner(client, { owner: zeroAddress, signal }),
      effect: () => Effect_.SmartAccount.addOwner(client, { owner: zeroAddress })
    }
  },
  "SmartAccount.addOwnerSync": {
    kind: "async",
    failure: {
      promise: (signal) => SmartAccount.addOwnerSync(client, { owner: zeroAddress, signal }),
      effect: () => Effect_.SmartAccount.addOwnerSync(client, { owner: zeroAddress })
    }
  },
  "SmartAccount.removeOwnerCalls": {
    kind: "async",
    failure: {
      promise: async (signal) =>
        SmartAccount.removeOwnerCalls(await KernelAccount.from({ client, owner }), {
          owner: zeroAddress,
          signal
        }),
      effect: () =>
        Effect.promise(() => KernelAccount.from({ client, owner })).pipe(
          Effect.flatMap((account) => Effect_.SmartAccount.removeOwnerCalls(account, { owner: zeroAddress }))
        )
    }
  },
  "SmartAccount.removeOwner": {
    kind: "async",
    failure: {
      promise: (signal) => SmartAccount.removeOwner(client, { owner: zeroAddress, signal }),
      effect: () => Effect_.SmartAccount.removeOwner(client, { owner: zeroAddress })
    }
  },
  "SmartAccount.removeOwnerSync": {
    kind: "async",
    failure: {
      promise: (signal) => SmartAccount.removeOwnerSync(client, { owner: zeroAddress, signal }),
      effect: () => Effect_.SmartAccount.removeOwnerSync(client, { owner: zeroAddress })
    }
  },
  "SmartAccount.setThresholdCalls": {
    kind: "async",
    failure: {
      promise: async (signal) =>
        SmartAccount.setThresholdCalls(await KernelAccount.from({ client, owner }), { threshold: 1, signal }),
      effect: () =>
        Effect.promise(() => KernelAccount.from({ client, owner })).pipe(
          Effect.flatMap((account) => Effect_.SmartAccount.setThresholdCalls(account, { threshold: 1 }))
        )
    }
  },
  "SmartAccount.setThreshold": {
    kind: "async",
    failure: {
      promise: (signal) => SmartAccount.setThreshold(client, { threshold: 1, signal }),
      effect: () => Effect_.SmartAccount.setThreshold(client, { threshold: 1 })
    }
  },
  "SmartAccount.setThresholdSync": {
    kind: "async",
    failure: {
      promise: (signal) => SmartAccount.setThresholdSync(client, { threshold: 1, signal }),
      effect: () => Effect_.SmartAccount.setThresholdSync(client, { threshold: 1 })
    }
  },
  "SmartAccount.replaceOwnerCalls": {
    kind: "async",
    failure: {
      promise: async (signal) =>
        SmartAccount.replaceOwnerCalls(await KernelAccount.from({ client, owner }), {
          owner: zeroAddress,
          with: owner.address,
          signal
        }),
      effect: () =>
        Effect.promise(() => KernelAccount.from({ client, owner })).pipe(
          Effect.flatMap((account) =>
            Effect_.SmartAccount.replaceOwnerCalls(account, { owner: zeroAddress, with: owner.address })
          )
        )
    }
  },
  "SmartAccount.replaceOwner": {
    kind: "async",
    failure: {
      promise: (signal) => SmartAccount.replaceOwner(client, { owner: zeroAddress, with: owner.address, signal }),
      effect: () => Effect_.SmartAccount.replaceOwner(client, { owner: zeroAddress, with: owner.address })
    }
  },
  "SmartAccount.replaceOwnerSync": {
    kind: "async",
    failure: {
      promise: (signal) => SmartAccount.replaceOwnerSync(client, { owner: zeroAddress, with: owner.address, signal }),
      effect: () => Effect_.SmartAccount.replaceOwnerSync(client, { owner: zeroAddress, with: owner.address })
    }
  },
  "SmartAccount.addOwnerValidatorCalls": {
    kind: "async",
    failure: {
      promise: async (signal) =>
        SmartAccount.addOwnerValidatorCalls(await KernelAccount.from({ client, owner }), {
          owner: owner.address,
          signal
        }),
      effect: () =>
        Effect.promise(() => KernelAccount.from({ client, owner })).pipe(
          Effect.flatMap((account) => Effect_.SmartAccount.addOwnerValidatorCalls(account, { owner: owner.address }))
        )
    }
  },
  "SmartAccount.addOwnerValidator": {
    kind: "async",
    failure: {
      promise: (signal) => SmartAccount.addOwnerValidator(client, { owner: owner.address, signal }),
      effect: () => Effect_.SmartAccount.addOwnerValidator(client, { owner: owner.address })
    }
  },
  "SmartAccount.addOwnerValidatorSync": {
    kind: "async",
    failure: {
      promise: (signal) => SmartAccount.addOwnerValidatorSync(client, { owner: owner.address, signal }),
      effect: () => Effect_.SmartAccount.addOwnerValidatorSync(client, { owner: owner.address })
    }
  },
  "SmartAccount.getOwners": {
    kind: "async",
    success: {
      promise: (signal) => SmartAccount.getOwners(client, { address: zeroAddress, signal }),
      effect: () => Effect_.SmartAccount.getOwners(client, { address: zeroAddress })
    },
    failure: {
      promise: (signal) => SmartAccount.getOwners(unreachable, { address: zeroAddress, signal }),
      effect: () => Effect_.SmartAccount.getOwners(unreachable, { address: zeroAddress })
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
