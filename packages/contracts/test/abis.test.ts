import { assert, describe, it } from "@effect/vitest";
import { Array as Arr } from "effect";

import { ecdsaSessionValidatorAbi, smartSessionAbi } from "@namera-ai/contracts";
import { toFunctionSelector, type Abi } from "viem";

const selectors = (abi: Abi) =>
  Arr.flatMap(abi, (item) => (item.type === "function" ? [toFunctionSelector(item)] : []));

describe("ABIs", () => {
  it("include the SmartSession entry points the SDK calls", () => {
    const smartSessionSelectors = selectors(smartSessionAbi);

    for (const signature of [
      "function validateUserOp((address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes),bytes32)",
      "function isValidSignatureWithSender(address,bytes32,bytes)",
      "function revokeEnableSignature(bytes32)",
      "function removeSession(bytes32)",
    ]) {
      assert.include(smartSessionSelectors, toFunctionSelector(signature));
    }
  });

  it("include the session validator check", () => {
    assert.include(
      selectors(ecdsaSessionValidatorAbi),
      toFunctionSelector("function validateSignatureWithData(bytes32,bytes,bytes)"),
    );
  });
});
