import { Schema } from "effect";

import { describe, expect, it } from "vitest";

import { CompleteExecutionRequest } from "../../../src/dto/execution-signing.js";

const prepare = {
  namespace: "eip155",
  walletId: "01950000-0000-7000-8000-000000000001",
  sessionKeyId: "01950000-0000-7000-8000-000000000002",
  chainId: "eip155:11155111",
  calls: [{ to: `0x${"11".repeat(20)}`, value: "1000000000000000000", data: "0x" }],
};

describe("local execution wire contracts", () => {
  it("only returns stored-operation identity and raw signature from completion input", () => {
    // Shape validation is separate from cryptographic verification in EVM.
    const input = {
      namespace: "eip155",
      submissionId: "01950000-0000-7000-8000-000000000003",
      signature: `0x${"11".repeat(64)}1b`,
    };
    expect(
      Schema.decodeUnknownSync(CompleteExecutionRequest)({
        ...input,
        calls: prepare.calls,
        sponsor: false,
        sessionKeyId: prepare.sessionKeyId,
      }),
    ).toEqual(input);
  });

  it.each(["0x", `0x${"11".repeat(32)}`, `0x${"11".repeat(64)}`, `0xff00${"11".repeat(65)}`])(
    "rejects digests, compact signatures, and already-wrapped signatures",
    (signature) => {
      expect(() =>
        Schema.decodeUnknownSync(CompleteExecutionRequest)({
          namespace: "eip155",
          submissionId: "01950000-0000-7000-8000-000000000003",
          signature,
        }),
      ).toThrow();
    },
  );
});
