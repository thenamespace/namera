import { parseAbi, type Abi } from "viem";
import { describe, expect, it } from "vitest";

import {
  abiFunctionOptions,
  filterFunctions,
  selectFunctions,
} from "../../src/components/evm-function-picker/functions";

describe("ABI function selection", () => {
  const abi = parseAbi([
    "function transfer(address to, uint256 amount) returns (bool)",
    "function transfer(address to, uint256 amount, bytes data) returns (bool)",
    "function balanceOf(address owner) view returns (uint256)",
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "error Unauthorized()",
  ]);

  it("keeps overloads distinct, deduplicates signatures and excludes non-functions", () => {
    const options = abiFunctionOptions([...abi, abi[0]]);
    expect(options.map((fn) => fn.signature)).toEqual([
      "balanceOf(address)",
      "transfer(address,uint256,bytes)",
      "transfer(address,uint256)",
    ]);
    expect(options.find((fn) => fn.signature === "transfer(address,uint256)")?.selector).toBe(
      "0xa9059cbb",
    );
  });

  it("canonicalizes nested tuple arrays without parameter names", () => {
    const tupleAbi = [
      {
        type: "function",
        name: "execute",
        stateMutability: "payable",
        outputs: [],
        inputs: [
          {
            name: "batch",
            type: "tuple[]",
            components: [
              { name: "target", type: "address" },
              {
                name: "calls",
                type: "tuple[]",
                components: [
                  { name: "amount", type: "uint256" },
                  { name: "data", type: "bytes" },
                ],
              },
            ],
          },
        ],
      },
    ] as const satisfies Abi;
    expect(abiFunctionOptions(tupleAbi)[0]?.signature).toBe(
      "execute((address,(uint256,bytes)[])[])",
    );
  });

  it("searches signatures, selectors and mutability without case sensitivity", () => {
    const options = abiFunctionOptions(abi);
    expect(filterFunctions(options, "  0xA9059CBB ").map((fn) => fn.signature)).toEqual([
      "transfer(address,uint256)",
    ]);
    expect(filterFunctions(options, "view").map((fn) => fn.signature)).toEqual([
      "balanceOf(address)",
    ]);
    expect(filterFunctions(options, "transfer")).toHaveLength(2);
    expect(filterFunctions(options, "missing")).toEqual([]);
  });

  it("selecting filtered results preserves hidden selections and excludes stale signatures", () => {
    const options = abiFunctionOptions(abi);
    expect(
      selectFunctions(
        ["balanceOf(address)", "stale()"],
        ["transfer(address,uint256)", "transfer(address,uint256)"],
        options,
      ),
    ).toEqual(["balanceOf(address)", "transfer(address,uint256)"]);
    expect(abiFunctionOptions([])).toEqual([]);
  });
});
