import type { Grant, KernelAccount } from "@namera-ai/sdk"
import { nameraActions } from "@namera-ai/sdk/decorators"
import { describe, expect, it } from "tstyche"
import { createPublicClient, http, type PublicClient } from "viem"
import { type BundlerClient, createBundlerClient } from "viem/account-abstraction"
import { base } from "viem/chains"

const publicClient = createPublicClient({ chain: base, transport: http() })
const owner = {} as KernelAccount.KernelAccount
const bundlerClient = createBundlerClient({ account: owner, client: publicClient, transport: http() })
const grant = {} as Grant.Grant

describe("nameraActions", () => {
  it("adds one namespace that none of viem's clients has", () => {
    expect<Extract<keyof PublicClient, "namera">>().type.toBe<never>()
    expect<Extract<keyof BundlerClient, "namera">>().type.toBe<never>()
    expect(publicClient.extend(nameraActions()).getBlockNumber).type.toBe(publicClient.getBlockNumber)
    expect(bundlerClient.extend(nameraActions()).sendUserOperation).type.toBe(bundlerClient.sendUserOperation)
  })

  it("gives a public client the reads", () => {
    const client = publicClient.extend(nameraActions())

    expect(client.namera.grant.getStatus({ grant })).type.toBe<Promise<Grant.getStatus.Status>>()
    expect(client.namera.account.detect).type.not.toRaiseError()
    expect(client.namera).type.toBe<nameraActions.Namera>()
  })

  it("gives only a bundler client the owner operations", () => {
    expect(publicClient.extend(nameraActions()).namera.grant).type.not.toHaveProperty("revoke")
    expect(publicClient.extend(nameraActions()).namera.account).type.not.toHaveProperty("installSessions")

    const client = bundlerClient.extend(nameraActions())
    expect(client.namera.grant.revoke({ grant })).type.toBe<Promise<`0x${string}` | undefined>>()
    expect(client.namera.account.installSessions()).type.toBe<Promise<`0x${string}`>>()
    expect(client.namera.grant.getStatus({ grant })).type.toBe<Promise<Grant.getStatus.Status>>()
  })
})
