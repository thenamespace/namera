import { assert, describe, it } from "@effect/vitest"
import * as Kernel from "@namera-ai/sdk/internal/core/account/kernel"
import * as SessionHook from "@namera-ai/sdk/internal/core/account/sessionHook"
import * as AbiFunction from "ox/AbiFunction"
import * as AbiParameters from "ox/AbiParameters"
import * as Hex from "ox/Hex"

const owners = ["0x1111111111111111111111111111111111111111", "0x2222222222222222222222222222222222222222"] as const

describe("account encodings", () => {
  it("reads Kernel's root validator, and none for an EIP-7702 account's own key", () => {
    const validator = owners[0]
    const encoded = (type: Hex.Hex) => Hex.padRight(Hex.concat(type, validator), 32)

    assert.strictEqual(Kernel.decodeRootValidator(encoded("0x01")), validator)
    assert.isUndefined(Kernel.decodeRootValidator(encoded("0x00")))
  })

  it("installs Smart Sessions on Kernel with SessionHook bound to it", () => {
    const sessions = {
      smartSession: "0x5555555555555555555555555555555555555555",
      sessionHook: "0x4444444444444444444444444444444444444444"
    } as const
    // SessionHook's install data: `abi.encode(address smartSession)`.
    const hookData = AbiParameters.encode(AbiParameters.from(["address"]), [sessions.smartSession])
    assert.strictEqual(SessionHook.installData(sessions.smartSession), hookData)

    // Smart Sessions' validation bound to SessionHook, flag 0xff, `execute` granted.
    const installModule = AbiFunction.from("function installModule(uint256, address, bytes)")
    const [type, module, initData] = AbiFunction.decodeData(installModule, Kernel.installSessionsData(sessions))
    assert.strictEqual(type, BigInt(1))
    assert.strictEqual(module.toLowerCase(), sessions.smartSession)
    assert.strictEqual(Hex.slice(initData, 0, 20), sessions.sessionHook)
    const [validatorData, kernelHookData, selectorData] = AbiParameters.decode(
      AbiParameters.from(["bytes", "bytes", "bytes"]),
      Hex.slice(initData, 20)
    )
    assert.strictEqual(validatorData, "0x")
    assert.strictEqual(kernelHookData, Hex.concat("0xff", hookData))
    assert.strictEqual(selectorData, "0xe9ae5c53")
  })

  it("reads the hook bound to a Kernel validator", () => {
    const validationConfig = AbiFunction.from("function validationConfig(bytes21) view returns (uint32, address)")
    assert.strictEqual(
      SessionHook.encodeValidationConfig(owners[0]),
      AbiFunction.encodeData(validationConfig, [Hex.concat("0x01", owners[0])])
    )
    const answer = AbiFunction.encodeResult(validationConfig, [7, owners[1]])
    assert.strictEqual(SessionHook.decodeValidationHook(answer), owners[1])
  })
})
