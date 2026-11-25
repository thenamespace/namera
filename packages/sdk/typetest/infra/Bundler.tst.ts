import {
  Bundler,
  type BundlerError,
  type CompatError,
  type Grant,
  type KernelAccount,
  type NameraError,
  Paymaster,
  type PaymasterError
} from "@namera-ai/sdk"
import { Bundler as EffectBundler, Paymaster as EffectPaymaster } from "@namera-ai/sdk/effect"
import { describe, expect, it } from "tstyche"
import type { Chain, PublicClient, Transport } from "viem"
import { createBundlerClient, type SmartAccount } from "viem/account-abstraction"

describe("Bundler and Paymaster", () => {
  it("spread into viem's bundler client with Namera's accounts", () => {
    const client = {} as PublicClient<Transport, Chain>
    const owner = {} as KernelAccount.KernelAccount
    const agent = {} as Awaited<ReturnType<typeof Grant.toAccount>>

    expect(
      createBundlerClient({
        account: owner,
        client,
        ...Bundler.candide({}),
        paymaster: Paymaster.circle({ token: "USDC" })
      })
    ).type.not.toRaiseError()
    expect(
      createBundlerClient({
        account: agent,
        client,
        ...Bundler.pimlico({ apiKey: "" }),
        paymaster: Paymaster.pimlico({ apiKey: "" })
      })
    ).type.not.toRaiseError()
    expect(createBundlerClient({ account: owner, client, ...Bundler.pimlico({ apiKey: "" }) }).account).type.toBe<
      KernelAccount.KernelAccount
    >()
    expect(agent).type.toBeAssignableTo<SmartAccount>()
  })

  it("are the same values in the Effect API", () => {
    expect(EffectBundler.pimlico).type.toBe(Bundler.pimlico)
    expect(EffectPaymaster.circle).type.toBe(Paymaster.circle)
  })

  it("name their vendor", () => {
    expect<Bundler.Bundler["vendor"]>().type.toBe<
      "pimlico" | "alchemy" | "candide" | "zerodev" | "etherspot" | "custom"
    >()
    expect<Paymaster.Paymaster["vendor"]>().type.toBe<
      "pimlico" | "pimlico-erc20" | "alchemy" | "candide" | "zerodev" | "etherspot" | "circle" | "erc7677"
    >()
  })

  it("add their errors to NameraError", () => {
    expect<BundlerError.BundlerError>().type.toBeAssignableTo<NameraError.NameraError>()
    expect<PaymasterError.PaymasterError>().type.toBeAssignableTo<NameraError.NameraError>()
    expect<CompatError.CompatError>().type.toBeAssignableTo<NameraError.NameraError>()
  })
})
