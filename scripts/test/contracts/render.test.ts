import { assert, describe, it } from "@effect/vitest"
import { String as Str } from "effect"

import { packageSources } from "../../contracts/render.ts"
import { contract, external, transaction } from "./contracts.fixture.ts"

describe("packageSources", () => {
  it("renders each external group as one documented export, keyed by version", () => {
    const module = packageSources([contract], [], external).get("External.ts") ?? ""

    assert.include(
      module,
      "export const kernel = {\"3.3\": {\"factory\": \"0x2577507b78c2008Ff367261CB6285d44ba5eF2E9\"}} as const;"
    )
    // The version note is a `**Details**` section: a TSDoc short description is one paragraph.
    assert.include(module, " * **Details**\n *\n * Keyed by version (`3.3`).")
    assert.include(
      packageSources([contract], [], external).get("index.ts"),
      "export * as External from \"./External.ts\";"
    )
  })

  it("renders the Contract types, one module per contract and an index", () => {
    const sources = packageSources([contract], [], external)

    assert.deepStrictEqual([...sources.keys()], ["Contract.ts", "Example.ts", "External.ts", "index.ts"])
    assert.include(sources.get("index.ts"), "export type * as Contract from \"./Contract.ts\";")
    assert.include(sources.get("index.ts"), "export * as Example from \"./Example.ts\";")
    assert.include(
      sources.get("Example.ts"),
      "export const v1: Contract.Version<typeof abiV1> = {"
    )
    assert.include(sources.get("Example.ts"), "\"address\": addressV1")
    assert.include(sources.get("Example.ts"), "\"abi\": abiV1")
    assert.include(sources.get("Example.ts"), "\"deployments\": deploymentsV1")
  })

  it("exports each part of a version on its own, the errors alone in ABI order", () => {
    const failing = {
      ...contract,
      abi: [
        { type: "error", name: "First", inputs: [] },
        ...contract.abi,
        { type: "error", name: "Second", inputs: [{ name: "code", type: "uint8" }] }
      ]
    }
    const module = packageSources([failing], [], external).get("Example.ts") ?? ""

    assert.include(module, `export const addressV1 = "${contract.address}" as const;`)
    assert.include(module, "export const abiV1 = [{\"type\": \"error\", \"name\": \"First\"")
    assert.include(
      module,
      "export const errorsV1 = [{\"type\": \"error\", \"name\": \"First\", \"inputs\": []}, {\"type\": \"error\", \"name\": \"Second\""
    )
    assert.include(module, "export const deploymentsV1: Contract.Version<typeof abiV1>[\"deployments\"] = {};")
  })

  it("renders each deployment by chain id with its block number as a bigint", () => {
    const sources = packageSources(
      [contract],
      [
        {
          chainId: 84532,
          contracts: {
            [contract.label]: {
              contract: contract.contract,
              artifact: contract.artifact,
              address: contract.address,
              factory: "0x4e59b44847b379578588920cA78FbF26c0B4956C",
              salt: contract.salt,
              initcodeHash: contract.initcodeHash,
              runtimeCodeHash: `0x${Str.repeat(32)("ef")}`,
              transaction,
              source: { commit: "9637c588", ...contract.compiler }
            }
          }
        }
      ],
      external
    )

    const module = sources.get("Example.ts") ?? ""
    assert.include(module, `84532: {"runtimeCodeHash": "0x${Str.repeat(32)("ef")}"`)
    assert.include(module, `"blockNumber": /* @__PURE__ */ BigInt("${transaction.blockNumber}")`)
  })

  it("wraps doc comments within 100 columns", () => {
    for (const source of packageSources([contract], [], external).values()) {
      for (const line of Str.split(source, "\n")) {
        if (Str.startsWith(" *")(line)) assert.isAtMost(line.length, 100, line)
      }
    }
  })
})
