import { assert, describe, it } from "@effect/vitest"
import { Option, Result, String as Str } from "effect"

import { concat, keccak256 } from "viem"

import { broadcastCreations, deploymentRecord } from "../../contracts/records.ts"
import { contract, initcode, runtimeCode, transaction } from "./contracts.fixture.ts"

const salt = contract.salt

const observe = (overrides: Partial<Parameters<typeof deploymentRecord>[1]> = {}) => ({
  code: runtimeCode,
  previous: Option.none(),
  transaction: Option.some(transaction),
  commit: "9637c588",
  ...overrides
})

describe("deploymentRecord", () => {
  it("writes no record while the contract has no code", () => {
    const outcome = deploymentRecord(contract, observe({ code: "0x", transaction: Option.none() }))

    assert.deepStrictEqual(outcome, Result.succeed(Option.none()))
  })

  it("records a new deployment with its transaction, source and code hash", () => {
    const outcome = deploymentRecord(contract, observe())

    assert.isTrue(Result.isSuccess(outcome))
    const record = Option.getOrThrow(Result.getOrThrow(outcome))
    assert.strictEqual(record.address, contract.address)
    assert.strictEqual(record.runtimeCodeHash, keccak256(runtimeCode))
    assert.deepStrictEqual(record.transaction, transaction)
    assert.deepStrictEqual(record.source, { commit: "9637c588", ...contract.compiler })
  })

  it("keeps a committed record that still matches the chain", () => {
    const committed = Option.getOrThrow(Result.getOrThrow(deploymentRecord(contract, observe())))

    const outcome = deploymentRecord(
      contract,
      observe({ previous: Option.some(committed), transaction: Option.none(), commit: "later" })
    )

    assert.deepStrictEqual(outcome, Result.succeed(Option.some(committed)))
  })

  it("fails when the recorded code is gone or changed", () => {
    const committed = Option.getOrThrow(Result.getOrThrow(deploymentRecord(contract, observe())))

    const gone = deploymentRecord(
      contract,
      observe({ code: "0x", previous: Option.some(committed) })
    )
    const changed = deploymentRecord(
      contract,
      observe({ code: "0x60016002", previous: Option.some(committed) })
    )

    assert.isTrue(Result.isFailure(gone))
    assert.isTrue(Result.isFailure(changed))
  })

  // Alpha: changed code keeps its label and moves to a new address.
  it("replaces a record at another address once the current build is deployed, and keeps it until then", () => {
    const committed = Option.getOrThrow(Result.getOrThrow(deploymentRecord(contract, observe())))
    const elsewhere = Option.some({ ...committed, address: "0x0000000000000000000000000000000000000001" as const })

    const replaced = Option.getOrThrow(Result.getOrThrow(deploymentRecord(contract, observe({ previous: elsewhere }))))
    assert.strictEqual(replaced.address, contract.address)
    assert.deepStrictEqual(replaced.transaction, transaction)

    const pending = deploymentRecord(contract, observe({ code: "0x", previous: elsewhere, transaction: Option.none() }))
    assert.deepStrictEqual(pending, Result.succeed(Option.none()))
  })
})

const creation = (input: `0x${string}`) => ({
  chain: 84532,
  transactions: [
    {
      hash: transaction.transactionHash,
      transactionType: "CREATE2",
      contractAddress: Str.toLowerCase(contract.address),
      transaction: { input }
    }
  ]
})

describe("broadcastCreations", () => {
  it("finds the transaction that created each contract", () => {
    const { hashes, problems } = broadcastCreations(creation(concat([salt, initcode])), [contract])

    assert.strictEqual(hashes.get(contract.label), transaction.transactionHash)
    assert.deepStrictEqual(problems, [])
  })

  it("reports a creation whose initcode differs from the current build", () => {
    const { hashes, problems } = broadcastCreations(creation(concat([salt, "0x6001"])), [contract])

    assert.isFalse(hashes.has(contract.label))
    assert.strictEqual(problems.length, 1)
  })
})
