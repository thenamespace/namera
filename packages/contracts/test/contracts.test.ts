import { assert, describe, it } from "@effect/vitest"
import { Array as Arr } from "effect"

import { ECDSASessionValidator, SmartSession } from "@namera-ai/contracts"
import { type Abi, getContractAddress, keccak256, stringToHex, toFunctionSelector } from "viem"

const selectors = (abi: Abi) => Arr.flatMap(abi, (item) => (item.type === "function" ? [toFunctionSelector(item)] : []))

const versions = [SmartSession.v1, ECDSASessionValidator.v1]

describe("contract versions", () => {
  it("sit at the CREATE2 address of their label and initcode", () => {
    for (const version of versions) {
      assert.strictEqual(version.salt, keccak256(stringToHex(version.label)))
      assert.strictEqual(
        version.address,
        getContractAddress({
          opcode: "CREATE2",
          from: version.factory,
          salt: version.salt,
          bytecodeHash: version.initcodeHash
        })
      )
    }
  })

  it("include the SmartSession entry points the SDK calls", () => {
    const smartSessionSelectors = selectors(SmartSession.v1.abi)

    for (
      const signature of [
        "function validateUserOp((address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes),bytes32)",
        "function isValidSignatureWithSender(address,bytes32,bytes)",
        "function revokeEnableSignature(bytes32)",
        "function removeSession(bytes32)"
      ]
    ) {
      assert.include(smartSessionSelectors, toFunctionSelector(signature))
    }
  })

  it("include the session validator check", () => {
    assert.include(
      selectors(ECDSASessionValidator.v1.abi),
      toFunctionSelector("function validateSignatureWithData(bytes32,bytes,bytes)")
    )
  })
})
