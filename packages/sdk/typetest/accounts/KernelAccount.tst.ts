import {
  type AccountError,
  type ChainError,
  KernelAccount,
  type NexusAccount,
  type Safe7579Account,
  SmartAccount
} from "@namera-ai/sdk"
import type { KernelAccount as EffectKernelAccount, SmartAccount as EffectSmartAccount } from "@namera-ai/sdk/effect"
import type { Effect } from "effect"
import { describe, expect, it } from "tstyche"
import type { JsonRpcAccount, LocalAccount, PrivateKeyAccount } from "viem"
import type { SmartAccount as ViemSmartAccount, WebAuthnAccount } from "viem/account-abstraction"

describe("KernelAccount", () => {
  it("is a viem SmartAccount with Namera's metadata", () => {
    expect<KernelAccount.KernelAccount>().type.toBeAssignableTo<ViemSmartAccount>()
    expect<SmartAccount.SmartAccount>().type.toBeAssignableTo<ViemSmartAccount>()
    expect<KernelAccount.KernelAccount["namera"]["type"]>().type.toBe<"kernel">()
  })

  it("takes a local key, a JSON-RPC wallet, a passkey or several passkeys as owner, and only a local key for EIP-7702", () => {
    type Owner = LocalAccount | JsonRpcAccount | WebAuthnAccount | SmartAccount.Passkeys
    expect<KernelAccount.from.Options["owner"]>().type.toBe<Owner>()
    expect<NexusAccount.from.Options["owner"]>().type.toBe<Owner>()
    expect<SmartAccount.Passkeys>().type.toBe<{
      readonly passkeys: ReadonlyArray<WebAuthnAccount>
      readonly threshold?: number | undefined
    }>()
    expect<Safe7579Account.from.Options["owners"]>().type.toBe<
      ReadonlyArray<LocalAccount | JsonRpcAccount> | ReadonlyArray<WebAuthnAccount>
    >()
    expect<KernelAccount.fromEip7702.Options["owner"]>().type.toBe<PrivateKeyAccount>()
  })

  it("signs multichain user operations in both APIs", () => {
    expect(SmartAccount.signUserOperations).type.toBe<
      (options: SmartAccount.signUserOperations.Options) => Promise<ReadonlyArray<`0x${string}`>>
    >()
    expect<ReturnType<typeof EffectSmartAccount.signUserOperations>>().type.toBe<
      Effect.Effect<ReadonlyArray<`0x${string}`>, AccountError.AccountError>
    >()
  })

  it("returns a Promise in the Promise API and an Effect without requirements in the Effect API", () => {
    expect(KernelAccount.from).type.toBe<
      (options: KernelAccount.from.Options) => Promise<KernelAccount.KernelAccount>
    >()
    expect<ReturnType<typeof EffectKernelAccount.from>>().type.toBe<
      Effect.Effect<KernelAccount.KernelAccount, AccountError.AccountError | ChainError.ChainError>
    >()
  })

  it("declares its errors as a short union", () => {
    expect<KernelAccount.from.ErrorType>().type.toBe<AccountError.AccountError | ChainError.ChainError>()
    expect<SmartAccount.detect.ErrorType>().type.toBe<ChainError.ChainError>()
  })

  it("narrows detection results by type", () => {
    const detected = {} as SmartAccount.detect.ReturnType
    if (detected.type === "kernel") expect(detected.version).type.toBe<string>()
    if (detected.type === "unsupported") expect(detected.implementation).type.toBe<`0x${string}` | undefined>()
    expect<Safe7579Account.from.Options["threshold"]>().type.toBe<number | undefined>()
  })
})

describe("SmartAccount.from", () => {
  it("returns viem's smart account for the implementation, in both APIs", () => {
    expect(SmartAccount.from<SmartAccount.Implementation>).type.toBe<
      (
        implementation: SmartAccount.Implementation,
        options?: { readonly signal?: AbortSignal | undefined }
      ) => Promise<ViemSmartAccount<SmartAccount.Implementation>>
    >()
    expect<ReturnType<typeof EffectSmartAccount.from<SmartAccount.Implementation>>>().type.toBe<
      Effect.Effect<ViemSmartAccount<SmartAccount.Implementation>, AccountError.AccountError | ChainError.ChainError>
    >()
  })
})

describe("SmartAccount owners", () => {
  it("reads owner sets narrowed by their kind", () => {
    const set = {} as SmartAccount.OwnerSet
    if (set.type === "key") expect(set.owners).type.toBe<ReadonlyArray<`0x${string}`>>()
    if (set.type === "passkey") {
      expect(set.passkeys[0]!).type.toBe<{
        readonly credentialId: `0x${string}`
        readonly publicKey: `0x${string}`
        readonly requireUserVerification: boolean
      }>()
    }
    expect<ReturnType<typeof SmartAccount.getOwners>>().type.toBe<Promise<ReadonlyArray<SmartAccount.OwnerSet>>>()
  })

  it("takes keys, addresses and passkeys as owners, and returns calls, a hash or a receipt", () => {
    expect<LocalAccount>().type.toBeAssignableTo<SmartAccount.OwnerRef>()
    expect<`0x${string}`>().type.toBeAssignableTo<SmartAccount.OwnerRef>()
    expect<WebAuthnAccount>().type.toBeAssignableTo<SmartAccount.OwnerRef>()
    expect<ReturnType<typeof SmartAccount.addOwnerCalls>>().type.toBe<Promise<ReadonlyArray<SmartAccount.Call>>>()
    expect<ReturnType<typeof SmartAccount.removeOwner>>().type.toBe<Promise<`0x${string}`>>()
    expect<ReturnType<typeof EffectSmartAccount.setThresholdSync>>().type.toBe<
      Effect.Effect<
        Awaited<ReturnType<typeof SmartAccount.setThresholdSync>>,
        AccountError.AccountError | ChainError.ChainError
      >
    >()
  })
})
