import { Schema } from "effect";

import { describe, expect, it } from "vitest";

import {
  CompleteExecutionRequest,
  PrepareExecutionRequest,
} from "../../../src/dto/execution-signing.js";
import { SimulateExecutionRequest } from "../../../src/dto/execution.js";

const prepare = {
  namespace: "eip155",
  walletId: "01950000-0000-7000-8000-000000000001",
  sessionKeyId: "01950000-0000-7000-8000-000000000002",
  chainId: "eip155:11155111",
  calls: [{ to: `0x${"11".repeat(20)}`, value: "1000000000000000000", data: "0x" }],
};

describe("local execution wire contracts", () => {
  it("preserves exact native quantities and an explicit self-funded choice", () => {
    const input = { ...prepare, sponsor: false };
    const decoded = Schema.decodeUnknownSync(PrepareExecutionRequest)(input);
    expect(decoded.calls[0]?.value).toBe(1_000_000_000_000_000_000n);
    expect(Schema.encodeSync(PrepareExecutionRequest)(decoded)).toEqual(input);
  });

  it("requires a selected signer session without making sponsor mandatory", () => {
    expect(Schema.decodeUnknownSync(PrepareExecutionRequest)(prepare).sponsor).toBeUndefined();
    const { sessionKeyId: _sessionKeyId, ...missingSession } = prepare;
    expect(() => Schema.decodeUnknownSync(PrepareExecutionRequest)(missingSession)).toThrow();
    expect(() => Schema.decodeUnknownSync(SimulateExecutionRequest)(missingSession)).toThrow();
    expect(Schema.decodeUnknownSync(SimulateExecutionRequest)(prepare).sessionKeyId).toBe(
      prepare.sessionKeyId,
    );
  });

  it.each([
    { ...prepare, namespace: "solana" },
    { ...prepare, chainId: "eip155:137" },
    { ...prepare, calls: [] },
    { ...prepare, calls: [{ ...prepare.calls[0], value: "-1" }] },
  ])("rejects an unsupported or invalid preparation", (input) => {
    expect(() => Schema.decodeUnknownSync(PrepareExecutionRequest)(input)).toThrow();
  });

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
