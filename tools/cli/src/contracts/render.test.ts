import { assert, describe, it } from "@effect/vitest";
import { String as Str } from "effect";

import { contract, transaction } from "./contracts.fixture.ts";
import { packageSources } from "./render.ts";

describe("packageSources", () => {
  it("renders the Contract types, one module per contract and an index", () => {
    const sources = packageSources([contract], []);

    assert.deepStrictEqual([...sources.keys()], ["Contract.ts", "Example.ts", "index.ts"]);
    assert.include(sources.get("index.ts"), 'export type * as Contract from "./Contract.ts";');
    assert.include(sources.get("index.ts"), 'export * as Example from "./Example.ts";');
    assert.include(
      sources.get("Example.ts"),
      "export const v1: Contract.Version<typeof abiV1> = {",
    );
    assert.include(sources.get("Example.ts"), `"address": "${contract.address}"`);
    assert.include(sources.get("Example.ts"), '"abi": abiV1');
  });

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
              source: { commit: "9637c588", ...contract.compiler },
            },
          },
        },
      ],
    );

    const module = sources.get("Example.ts") ?? "";
    assert.include(module, `84532: {"runtimeCodeHash": "0x${Str.repeat(32)("ef")}"`);
    assert.include(module, `"blockNumber": ${transaction.blockNumber}n`);
  });

  it("wraps doc comments within 100 columns", () => {
    for (const source of packageSources([contract], []).values()) {
      for (const line of Str.split(source, "\n")) {
        if (Str.startsWith(" *")(line)) assert.isAtMost(line.length, 100, line);
      }
    }
  });
});
