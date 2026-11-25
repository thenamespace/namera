import type { Contract } from "@namera-ai/contracts"
import { SmartSession } from "@namera-ai/contracts"
import { describe, expect, it } from "tstyche"
import type { ContractErrorName, ContractFunctionName } from "viem"

describe("SmartSession.v1", () => {
  it("keeps the ABI literal, so viem infers function names", () => {
    expect<ContractFunctionName<typeof SmartSession.v1.abi>>().type.toBeAssignableFrom<"removeSession">()
    expect<ContractFunctionName<typeof SmartSession.v1.abi>>().type.not.toBeAssignableFrom<"notAFunction">()
  })

  it("looks deployments up by chain id, possibly undefined", () => {
    expect(SmartSession.v1.deployments[8453]).type.toBe<Contract.Deployment | undefined>()
  })

  it("keeps the error fragments literal, and only errors", () => {
    expect<ContractErrorName<typeof SmartSession.errorsV1>>().type.toBeAssignableFrom<"PolicyViolation">()
    expect<(typeof SmartSession.errorsV1)[number]["type"]>().type.toBe<"error">()
  })
})
