import { Schema } from "effect";

import { SessionKeyInstallationId } from "@namera-ai/protocol";
import { GetActiveSessionKeyOperationResponse } from "@namera-ai/protocol/dto";
import { describe, expect, it } from "vitest";

import { recoverSponsoredApproval } from "../../../src/components/session-key-installations/recovery";

const operation = Schema.decodeUnknownSync(GetActiveSessionKeyOperationResponse)({
  operation: {
    operationId: "01950000-0000-7000-8000-000000000001",
    status: "awaiting-signature",
    retryRequest: {
      installationId: "01950000-0000-7000-8000-000000000002",
      kind: "install",
      sponsor: true,
      idempotencyKey: "original-approval-attempt",
    },
  },
}).operation;
if (!operation?.retryRequest) throw new Error("Missing recovery fixture");
const target = operation.retryRequest;

describe("approval recovery", () => {
  it("resumes the original unsigned request without changing its identity", () => {
    expect(recoverSponsoredApproval(target, operation)).toBe(operation.retryRequest);
  });

  it("never resumes signed operations or another user's approval", () => {
    for (const status of ["signed", "submitted", "confirmed", "failed", "expired"] as const) {
      expect(recoverSponsoredApproval(target, { ...operation, status })).toBeUndefined();
    }
    expect(recoverSponsoredApproval(target, { ...operation, retryRequest: null })).toBeUndefined();
    expect(recoverSponsoredApproval(target, null)).toBeUndefined();
  });

  it("does not change a self-funded request or approve a different permission", () => {
    for (const retryRequest of [
      { ...target, sponsor: false },
      { ...target, kind: "uninstall" as const },
      {
        ...target,
        installationId: SessionKeyInstallationId.make("01950000-0000-7000-8000-000000000003"),
      },
    ]) {
      expect(recoverSponsoredApproval(target, { ...operation, retryRequest })).toBeUndefined();
    }
  });
});
