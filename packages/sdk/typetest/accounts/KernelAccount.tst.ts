import { type AccountError, type ChainError, KernelAccount, type Safe7579Account, SmartAccount } from "@namera-ai/sdk"
import type { KernelAccount as EffectKernelAccount, SmartAccount as EffectSmartAccount } from "@namera-ai/sdk/effect"
import type { Effect } from "effect"
import { describe, expect, it } from "tstyche"
import type { JsonRpcAccount, LocalAccount, PrivateKeyAccount } from "viem"
import type { SmartAccount as ViemSmartAccount } from "viem/account-abstraction"

describe("KernelAccount", () => {
  it("is a viem SmartAccount with Namera's metadata", () => {
    expect<KernelAccount.KernelAccount>().type.toBeAssignableTo<ViemSmartAccount>()
    expect<SmartAccount.SmartAccount>().type.toBeAssignableTo<ViemSmartAccount>()
    expect<KernelAccount.KernelAccount["namera"]["type"]>().type.toBe<"kernel">()
  })

  it("takes a local key or a JSON-RPC wallet as owner, and only a local key for EIP-7702", () => {
    expect<KernelAccount.from.Options["owner"]>().type.toBe<LocalAccount | JsonRpcAccount>()
    expect<KernelAccount.fromEip7702.Options["owner"]>().type.toBe<PrivateKeyAccount>()
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
