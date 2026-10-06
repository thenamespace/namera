import { Schema } from "effect";

import { SessionKeyInstallationResponse } from "@namera-ai/protocol/dto";
import { describe, expect, it } from "vitest";

import { expiryText, sessionSummary } from "../../src/services/output/session-summary.js";

const now = Date.UTC(2026, 9, 6);
const installation = Schema.decodeUnknownSync(SessionKeyInstallationResponse)({
  id: "01950000-0000-7000-8000-000000000001",
  chainId: "eip155:1",
  status: "installed",
  authorization: {
    version: 1,
    entityId: 7,
    signerAddress: `0x${"11".repeat(20)}`,
    permissions: [{ type: "root" }],
    validAfter: 0,
    validUntil: now / 1000 + 30 * 86400,
    allowSignatures: true,
  },
  installTransactionHash: null,
  uninstallTransactionHash: null,
});
const key = { metadata: { version: 1 as const, name: "Trading bot" }, status: "active" as const };

describe("session expiry summaries", () => {
  it("renders an accurate compact summary", () => {
    expect(sessionSummary(key, false, [installation], now)).toBe(
      "Trading bot | Active | Expires in 30 days",
    );
  });
  it("handles expiry boundaries without zero-day or negative countdowns", () => {
    const seconds = now / 1000;
    expect(expiryText(seconds + 86400, now)).toBe("Expires in 1 day");
    expect(expiryText(seconds + 3600, now)).toBe("Expires in 1 hour");
    expect(expiryText(seconds + 60, now)).toBe("Expires in 1 minute");
    expect(expiryText(seconds + 1, now)).toBe("Expires in less than a minute");
    expect(expiryText(seconds, now)).toBe("Expired");
    expect(expiryText(seconds - 86400, now)).toBe("Expired");
  });
  it("does not imply that every network expires at the same time", () => {
    const other = {
      ...installation,
      authorization: { ...installation.authorization, validUntil: now / 1000 + 86400 },
    };
    expect(sessionSummary(key, false, [installation, other], now)).toContain(
      "Expiry varies by network",
    );
    expect(sessionSummary(key, false, [installation, installation], now)).toContain(
      "Expires in 30 days",
    );
    expect(
      sessionSummary(key, false, [installation, { ...other, status: "revoked" }], now),
    ).toContain("Expires in 30 days");
  });
  it("distinguishes unavailable data from absent permissions and revoked keys", () => {
    expect(sessionSummary(key, false, undefined, now)).toContain("Expiry unavailable");
    expect(sessionSummary(key, false, [], now)).toContain("No network permissions");
    expect(sessionSummary({ ...key, status: "revoked" }, false, [installation], now)).toBe(
      "Trading bot | Revoked",
    );
  });
});
