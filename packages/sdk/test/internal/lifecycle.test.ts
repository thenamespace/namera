import { assert, describe, it } from "@effect/vitest"
import { SmartSession } from "@namera-ai/contracts"
import { Policy, Session, SessionKey } from "@namera-ai/sdk"
import { laneOf, nonceKey } from "@namera-ai/sdk/internal/core/agent/nonce"
import {
  encodeEnableSignature,
  encodeUseSignature,
  signaturePermissionId
} from "@namera-ai/sdk/internal/core/grant/enable"
import { encodeUpdate } from "@namera-ai/sdk/internal/core/grant/lifecycle"
import { contracts } from "@namera-ai/sdk/internal/session/contracts"
import * as AbiFunction from "ox/AbiFunction"
import * as Hash from "ox/Hash"
import * as Hex from "ox/Hex"

const account: Hex.Hex = "0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc"
const token: Hex.Hex = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
const recipient: Hex.Hex = "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65"
const salt = `0x${"11".repeat(32)}` as const

const sessionWith = (policies: ReadonlyArray<Policy.Policy>) =>
  Session.from({ signer: SessionKey.ecdsa(recipient), validUntil: 2_000_000_000, salt, policies })

const selectorsOf = (calls: ReadonlyArray<Hex.Hex>) => calls.map((call) => Hex.slice(call, 0, 4))
const selector = (name: "disableActionId" | "disableUserOpPolicies" | "enableSessions") =>
  AbiFunction.getSelector(AbiFunction.fromAbi(SmartSession.v1.abi, name))
const disableActionId = selector("disableActionId")
const disableUserOpPolicies = selector("disableUserOpPolicies")
const enableSessions = selector("enableSessions")

describe("updating a session", () => {
  const transfers = Policy.erc20Transfer({ token, to: [recipient], amount: { lte: 100n } })
  const previous = sessionWith([
    transfers,
    Policy.nativeTransfer({ to: [recipient] }),
    Policy.rateLimit({ count: 3, period: "day" })
  ])
  const next = sessionWith([transfers, Policy.spend({ token, amount: 5n, period: "day" })])
  const permissionId = Session.getPermissionId(previous)

  it("disables what an enabled session loses, then enables the new one (each call spends the enable nonce)", () => {
    const calls = encodeUpdate({
      permissionId,
      previous: Session.toSmartSession(previous),
      next: Session.toSmartSession(next),
      enabled: true
    })
    assert.deepStrictEqual(selectorsOf(calls), [disableUserOpPolicies, disableActionId, enableSessions])
    // The native transfer's action, and the rate limit's policy.
    assert.include(calls[1]!, Hash.keccak256(Hex.concat(recipient, "0xffffffff")).slice(2))
    assert.include(calls[0]!, contracts.rateLimitPolicy.slice(2).toLowerCase())
  })

  it("only enables the new session when the old one isn't enabled", () => {
    const calls = encodeUpdate({
      permissionId,
      previous: Session.toSmartSession(previous),
      next: Session.toSmartSession(next),
      enabled: false
    })
    assert.deepStrictEqual(selectorsOf(calls), [enableSessions])
  })
})

describe("reading operations back", () => {
  it("finds the lane of a nonce key that routes through Smart Sessions, and no lane otherwise", () => {
    for (const lane of [0, 9, 2 ** 16 - 1]) {
      assert.strictEqual(laneOf(contracts.smartSession, nonceKey(contracts.smartSession, lane)), lane)
      assert.isUndefined(laneOf(contracts.smartSession, nonceKey(account, lane)))
    }
  })

  it("reads the permission id from a USE or ENABLE signature", () => {
    const session = sessionWith([Policy.anyCall({ unsafe: true })])
    const id = Session.getPermissionId(session)
    assert.deepStrictEqual(signaturePermissionId(encodeUseSignature(id, "0x1234")), { mode: "use", permissionId: id })
    const grant = {
      account: `eip155:1:${account}` as const,
      session,
      chains: [{
        chain: "eip155:1" as const,
        contracts,
        nonce: 0n,
        sessionDigest: `0x${"22".repeat(32)}` as Hex.Hex,
        signature: "0x1234" as Hex.Hex
      }]
    }
    assert.deepStrictEqual(signaturePermissionId(encodeEnableSignature(grant, 1, "0x5678")), {
      mode: "enable",
      permissionId: id
    })
    assert.isUndefined(signaturePermissionId("0x02"))
    assert.isUndefined(signaturePermissionId(Hex.concat("0x01", Hex.padLeft("0x", 40))))
  })
})
