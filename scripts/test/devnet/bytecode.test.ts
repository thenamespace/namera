import { assert, describe, it } from "@effect/vitest"

import { parseFixtureName, renderDevnetBytecode } from "../../devnet/bytecode.ts"

describe("parseFixtureName", () => {
  it("reads the name and address of a fixture file", () => {
    assert.deepStrictEqual(parseFixtureName("entrypoint-0.7@0x0000000071727De22E5E9d8BAf0edAc6f37da032.hex"), {
      name: "entrypoint-0.7",
      address: "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
    })
  })

  it("skips files that aren't fixtures", () => {
    assert.isUndefined(parseFixtureName("README.md"))
    assert.isUndefined(parseFixtureName("kernel@0x1234.hex"))
  })
})

describe("renderDevnetBytecode", () => {
  it("lists fixtures by name and contracts in deployment order", () => {
    const source = renderDevnetBytecode(
      [
        { name: "zeta", address: "0x2", code: "0x02" },
        { name: "alpha", address: "0x1", code: "0x01" }
      ],
      [
        { label: "namera.b.v1", salt: "0xb", address: "0x4", initcode: "0x0b" },
        { label: "namera.a.v1", salt: "0xa", address: "0x3", initcode: "0x0a" }
      ]
    )

    assert.isBelow(source.indexOf("\"alpha\""), source.indexOf("\"zeta\""))
    assert.isBelow(source.indexOf("\"namera.b.v1\""), source.indexOf("\"namera.a.v1\""))
  })
})
