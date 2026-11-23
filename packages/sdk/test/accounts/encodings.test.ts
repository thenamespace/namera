import { assert, describe, it } from "@effect/vitest"
import { External } from "@namera-ai/contracts"
import * as Kernel from "@namera-ai/sdk/internal/core/account/kernel"
import * as Nexus from "@namera-ai/sdk/internal/core/account/nexus"
import * as Safe7579 from "@namera-ai/sdk/internal/core/account/safe7579"
import * as SessionHook from "@namera-ai/sdk/internal/core/account/sessionHook"
import * as AbiFunction from "ox/AbiFunction"
import * as AbiParameters from "ox/AbiParameters"
import * as Address from "ox/Address"
import * as Hash from "ox/Hash"
import * as Hex from "ox/Hex"

const setup = AbiFunction.from(
  "function setup(address[] owners, uint256 threshold, address to, bytes data, address fallbackHandler, address paymentToken, uint256 payment, address paymentReceiver)"
)
const owners = ["0x1111111111111111111111111111111111111111", "0x2222222222222222222222222222222222222222"] as const

describe("account encodings", () => {
  it("reads Kernel's root validator, and none for an EIP-7702 account's own key", () => {
    const validator = owners[0]
    const encoded = (type: Hex.Hex) => Hex.padRight(Hex.concat(type, validator), 32)

    assert.strictEqual(Kernel.decodeRootValidator(encoded("0x01")), validator)
    assert.isUndefined(Kernel.decodeRootValidator(encoded("0x00")))
  })

  it("finds the owner before another in a sentinel list", () => {
    assert.strictEqual(Safe7579.previousOwner(owners, owners[0]), "0x0000000000000000000000000000000000000001")
    assert.strictEqual(Safe7579.previousOwner(owners, owners[1]), owners[0])
    assert.isUndefined(Safe7579.previousOwner(owners, "0x3333333333333333333333333333333333333333"))
  })

  it("initialises a key-owned Nexus without sessions on its default validator alone", () => {
    const call = Nexus.bootstrapCall({ owner: { type: "default", address: owners[0] } })

    assert.strictEqual(
      Hex.slice(call, 0, 4),
      AbiFunction.getSelector("function initNexusWithDefaultValidator(bytes data)")
    )
  })

  it("gives a Safe the key owners' threshold, and a passkey Safe one owner no key controls", () => {
    const contracts = External.safe7579["2"]
    const [ownable] = AbiFunction.decodeData(
      setup,
      Safe7579.initializer({ contracts, owner: { type: "ownable", owners, threshold: BigInt(2) } })
    ).slice(1, 2)
    const passkey = AbiFunction.decodeData(
      setup,
      Safe7579.initializer({ contracts, owner: { type: "module", validator: owners[0], data: "0x" } })
    )

    assert.strictEqual(ownable, BigInt(2))
    assert.deepStrictEqual(passkey[0], [Safe7579.moduleOwnedSafeOwner])
    assert.strictEqual(passkey[1], BigInt(1))
    assert.strictEqual(
      Safe7579.moduleOwnedSafeOwner,
      Address.checksum(Hex.slice(Hash.keccak256(Hex.fromString("namera.safe7579.module-owned")), 12))
    )
    assert.strictEqual(Safe7579.moduleOwnedSafeOwner, "0x2F2c8b5807e5f0BaCe64b617e5D8AF489F8af8F5")
  })

  it("installs Smart Sessions with SessionHook on each account", () => {
    const sessions = {
      smartSession: "0x5555555555555555555555555555555555555555",
      sessionHook: "0x4444444444444444444444444444444444444444"
    } as const
    const hookData = (flavour: number) =>
      AbiParameters.encode(AbiParameters.from(["uint8", "address"]), [flavour, sessions.smartSession])
    assert.strictEqual(SessionHook.installData("kernel", sessions.smartSession), hookData(1))
    assert.strictEqual(SessionHook.installData("nexus", sessions.smartSession), hookData(2))
    assert.strictEqual(SessionHook.installData("safe7579", sessions.smartSession), hookData(3))

    // Kernel: Smart Sessions' validation bound to SessionHook, flag 0xff, `execute` granted.
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
    assert.strictEqual(kernelHookData, Hex.concat("0xff", hookData(1)))
    assert.strictEqual(selectorData, "0xe9ae5c53")

    // Nexus: SessionHook in the bootstrap's hook slot, for a key owner and for a validator-module owner.
    for (
      const owner of [
        { type: "default", address: owners[0] },
        { type: "module", validator: owners[1], data: "0x" }
      ] as const
    ) {
      const call = Nexus.bootstrapCall({ owner, sessions })
      assert.include(call.toLowerCase(), sessions.sessionHook.slice(2))
      assert.include(call.toLowerCase(), hookData(2).slice(2))
    }

    // Safe7579: SessionHook as a type-4 module of the launchpad.
    const contracts = External.safe7579["2"]
    const initializer = Safe7579.initializer({
      contracts,
      owner: { type: "ownable", owners, threshold: BigInt(1) },
      sessions
    })
    assert.include(initializer.toLowerCase(), sessions.sessionHook.slice(2))
    assert.include(initializer.toLowerCase(), hookData(3).slice(2))
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

  it("reads the global hook of a Nexus or Safe7579 account", () => {
    assert.strictEqual(SessionHook.encodeGetActiveHook, "0x0a664dba")
    const answer = AbiParameters.encode(AbiParameters.from(["address"]), [owners[1]])
    assert.strictEqual(SessionHook.decodeActiveHook(answer), owners[1])
  })
})
