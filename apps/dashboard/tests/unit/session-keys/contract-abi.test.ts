import { describe, expect, it } from "vitest";

import { abiFunctionOptions } from "../../../src/components/evm-function-picker/functions";
import { parseContractAbi } from "../../../src/components/session-key-creation/policies/contract-access/abi";

describe("contract access ABI", () => {
  it("rejects malformed JSON and ABIs without valid functions", () => {
    for (const text of ["", "{", "[]", "{}", '[{"type":"function","name":"transfer"}]']) {
      expect(parseContractAbi(text)).toBeNull();
    }
  });
  it("preserves overloads and derives exact selectors", () => {
    const abi = parseContractAbi(
      JSON.stringify([
        {
          type: "function",
          name: "transfer",
          inputs: [
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [{ name: "", type: "bool" }],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "transfer",
          inputs: [{ name: "to", type: "address" }],
          outputs: [],
          stateMutability: "nonpayable",
        },
      ]),
    );
    expect(abi).not.toBeNull();
    const options = abiFunctionOptions(abi ?? []);
    expect(options).toHaveLength(2);
    expect(
      options.find((option) => option.signature === "transfer(address,uint256)")?.selector,
    ).toBe("0xa9059cbb");
    expect(new Set(options.map((option) => option.selector)).size).toBe(2);
  });
});
