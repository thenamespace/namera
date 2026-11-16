import { ecdsaSessionValidatorAbi, smartSessionAbi } from "@namera-ai/contracts";
import { toFunctionSelector } from "viem";
import { describe, expect, it } from "vitest";

const selectors = (abi: readonly { type: string }[]) =>
  abi.filter((item) => item.type === "function").map((item) => toFunctionSelector(item as never));

describe("ABIs", () => {
  it("include the SmartSession entry points the SDK calls", () => {
    expect(selectors(smartSessionAbi)).toEqual(
      expect.arrayContaining([
        toFunctionSelector(
          "function validateUserOp((address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes),bytes32)",
        ),
        toFunctionSelector("function isValidSignatureWithSender(address,bytes32,bytes)"),
        toFunctionSelector("function revokeEnableSignature(bytes32)"),
        toFunctionSelector("function removeSession(bytes32)"),
      ]),
    );
  });

  it("include the session validator check", () => {
    expect(selectors(ecdsaSessionValidatorAbi)).toContain(
      toFunctionSelector("function validateSignatureWithData(bytes32,bytes,bytes)"),
    );
  });
});
