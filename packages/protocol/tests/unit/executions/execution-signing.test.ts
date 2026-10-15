import { Schema } from "effect";

import { describe, expect, it } from "vitest";

import { CompleteExecutionRequest } from "../../../src/dto/execution-signing.js";
import { CompleteSignatureRequest } from "../../../src/dto/signature-signing.js";

const prepare = {
  namespace: "eip155",
  walletId: "01950000-0000-7000-8000-000000000001",
  sessionKeyId: "01950000-0000-7000-8000-000000000002",
  chainId: "eip155:11155111",
  calls: [{ to: `0x${"11".repeat(20)}`, value: "1000000000000000000", data: "0x" }],
};

describe("session operation wire contracts", () => {
  it("managed completion cannot replace the stored payload or signer", () => {
    const replacement = {
      digest: `0x${"11".repeat(32)}`,
      calls: prepare.calls,
      agentId: "different-agent",
      signingKeyId: prepare.sessionKeyId,
    };
    const execution = { namespace: "eip155", submissionId: "01950000-0000-7000-8000-000000000003" };
    const signature = { namespace: "eip155", operationId: "01950000-0000-7000-8000-000000000004" };
    expect(
      Schema.decodeUnknownSync(CompleteExecutionRequest)({ ...execution, ...replacement }),
    ).toEqual(execution);
    expect(
      Schema.decodeUnknownSync(CompleteSignatureRequest)({
        ...signature,
        ...replacement,
        message: "replacement",
      }),
    ).toEqual(signature);
    expect(() =>
      Schema.decodeUnknownSync(CompleteExecutionRequest)({
        namespace: "eip155",
        ...replacement,
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(CompleteSignatureRequest)({
        namespace: "eip155",
        ...replacement,
      }),
    ).toThrow();
  });
  for (const { name, decode, identity } of [
    {
      name: "execution",
      decode: Schema.decodeUnknownSync(CompleteExecutionRequest),
      identity: { submissionId: "01950000-0000-7000-8000-000000000003" },
    },
    {
      name: "signature",
      decode: Schema.decodeUnknownSync(CompleteSignatureRequest),
      identity: { operationId: "01950000-0000-7000-8000-000000000004" },
    },
  ]) {
    it(`${name} completion keeps only stored identity and the raw signature`, () => {
      // Shape validation is separate from cryptographic verification in EVM.
      const input = {
        namespace: "eip155",
        ...identity,
        signature: `0x${"11".repeat(64)}1b`,
      };
      expect(
        decode({
          ...input,
          calls: prepare.calls,
          sponsor: false,
          sessionKeyId: prepare.sessionKeyId,
        }),
      ).toEqual(input);
    });

    it.each([
      { name: "empty bytes", signature: "0x" },
      { name: "digest", signature: `0x${"11".repeat(32)}` },
      { name: "compact signature", signature: `0x${"11".repeat(64)}` },
      { name: "wrapped signature", signature: `0xff00${"11".repeat(65)}` },
    ])(`${name} completion rejects $name`, ({ signature }) => {
      expect(() =>
        decode({
          namespace: "eip155",
          ...identity,
          signature,
        }),
      ).toThrow();
    });
  }
});
