import type { Contract } from "@namera-ai/contracts"
import { SmartSession } from "@namera-ai/contracts"
import { describe, expect, it } from "tstyche"
import type { ContractFunctionName } from "viem"

describe("SmartSession.v1", () => {
  it("keeps the ABI literal, so viem infers function names", () => {
    expect<ContractFunctionName<typeof SmartSession.v1.abi>>().type.toBeAssignableFrom<"removeSession">()
    expect<ContractFunctionName<typeof SmartSession.v1.abi>>().type.not.toBeAssignableFrom<"notAFunction">()
  })

  it("looks deployments up by chain id, possibly undefined", () => {
    expect(SmartSession.v1.deployments[8453]).type.toBe<Contract.Deployment | undefined>()
  })
})
