import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Record as Rec } from "effect";

import { ECDSASessionValidator, SmartSession } from "@namera-ai/contracts";
import { getContractAddress, keccak256, stringToHex, toFunctionSelector, type Abi } from "viem";

const selectors = (abi: Abi) =>
  Arr.flatMap(abi, (item) => (item.type === "function" ? [toFunctionSelector(item)] : []));

const versions = [SmartSession.v1, ECDSASessionValidator.v1];

describe("contract versions", () => {
  it("sit at the CREATE2 address of their label and initcode", () => {
    for (const version of versions) {
      assert.strictEqual(version.salt, keccak256(stringToHex(version.label)));
      assert.strictEqual(
        version.address,
        getContractAddress({
          opcode: "CREATE2",
          from: version.factory,
          salt: version.salt,
          bytecodeHash: version.initcodeHash,
        }),
      );
    }
  });

  it("label each version with its version number", () => {
    assert.match(SmartSession.v1.label, /\.v1$/);
    assert.match(ECDSASessionValidator.v1.label, /\.v1$/);
  });

  it("include the SmartSession entry points the SDK calls", () => {
    const smartSessionSelectors = selectors(SmartSession.v1.abi);

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
      selectors(ECDSASessionValidator.v1.abi),
      toFunctionSelector("function validateSignatureWithData(bytes32,bytes,bytes)"),
    );
  });

  it("record the runtime code hash of every deployment", () => {
    for (const version of versions) {
      for (const deployment of Rec.values(version.deployments)) {
        assert.match(deployment?.runtimeCodeHash ?? "", /^0x[0-9a-f]{64}$/);
      }
    }
  });
});
