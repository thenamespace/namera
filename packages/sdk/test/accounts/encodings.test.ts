import { assert, describe, it } from "@effect/vitest"
import { External } from "@namera-ai/contracts"
import * as Nexus from "@namera-ai/sdk/internal/core/account/nexus"
import * as Safe7579 from "@namera-ai/sdk/internal/core/account/safe7579"
import * as AbiFunction from "ox/AbiFunction"
import * as Address from "ox/Address"
import * as Hash from "ox/Hash"
import * as Hex from "ox/Hex"

const setup = AbiFunction.from(
  "function setup(address[] owners, uint256 threshold, address to, bytes data, address fallbackHandler, address paymentToken, uint256 payment, address paymentReceiver)"
)
const owners = ["0x1111111111111111111111111111111111111111", "0x2222222222222222222222222222222222222222"] as const

describe("account encodings", () => {
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
})
