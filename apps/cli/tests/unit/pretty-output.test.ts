import { DateTime, Schema } from "effect";

import { WalletId, SessionKeyId } from "@namera-ai/protocol";
import {
  WalletOwnerResponse,
  GetExecutionSubmissionResponse,
  VerifySignatureResponse,
  SessionKeyInstallationResponse,
} from "@namera-ai/protocol/dto";
import { EthereumAddress } from "@namera-ai/protocol/evm";
import { WalletMetadata, WalletStatus } from "@namera-ai/protocol/model";
import { describe, expect, it } from "vitest";

import { formatValue } from "../../src/services/output.js";
import { fields, network, recordView, terminalText } from "../../src/services/output/document.js";
import {
  executionsView,
  executionStatusView,
  verificationView,
} from "../../src/services/output/execution.js";
import { sessionKeyView, sessionKeysView } from "../../src/services/output/session-key.js";
import { walletView, walletsView } from "../../src/services/output/wallet.js";

const wallet = Schema.decodeUnknownSync(
  Schema.Struct({
    id: WalletId,
    metadata: WalletMetadata,
    status: WalletStatus,
    address: EthereumAddress,
    namespace: Schema.Literal("eip155"),
    owner: WalletOwnerResponse,
    createdAt: Schema.DateTimeUtcFromDate,
  }),
)({
  id: "01950000-0000-7000-8000-000000000001",
  metadata: { version: 1, name: "Trading Account", logo: { type: "emoji", value: "💳" } },
  status: "active",
  namespace: "eip155",
  address: `0x${"11".repeat(20)}`,
  owner: {
    signingKeyId: "01950000-0000-7000-8000-000000000002",
    custody: "local",
    algorithm: "p256",
  },
  createdAt: new Date("2026-09-15T12:00:00Z"),
});

const unexpectedPretty = () => {
  throw new Error("Must not run");
};

describe("command-specific pretty output", () => {
  it("groups session authorization by network and separates offchain policies", () => {
    const installation = Schema.decodeUnknownSync(SessionKeyInstallationResponse)({
      id: wallet.id,
      chainId: "eip155:11155111",
      status: "pending",
      authorization: {
        version: 1,
        entityId: 7,
        signerAddress: wallet.address,
        permissions: [{ type: "root" }],
        validAfter: 0,
        validUntil: 1800000000,
        allowSignatures: true,
      },
      installTransactionHash: null,
      uninstallTransactionHash: null,
    });
    const key = {
      id: Schema.decodeUnknownSync(SessionKeyId)(wallet.id),
      metadata: { version: 1 as const, name: "Trading bot" },
      status: "pending" as const,
      walletId: wallet.id,
      wallet,
      createdAt: wallet.createdAt,
      revokedAt: null,
      installations: [installation],
      policies: [],
    };
    const text = sessionKeyView(key, false);
    expect(text).toContain("Sepolia (eip155:11155111)\n  Status: Pending");
    expect(text).toContain("Starts: Immediately after installation");
    expect(text).toContain("Signatures: Enabled");
    expect(text).toContain("Unrestricted account access");
    expect(text).toContain("Offchain policies\n  Policies: None");
    expect(sessionKeysView([key], false)).not.toContain("Onchain permissions");
  });
  it("leads with the wallet name and preserves copyable identifiers", () => {
    const text = walletsView([wallet], false);
    expect(text).toContain("Found 1 delegated wallet:");
    expect(text).toContain("💳 Trading Account\n  Status: Active");
    expect(text).toContain(`Address: ${wallet.address}`);
    expect(text).toContain(`Wallet ID: ${wallet.id}`);
    expect(text).toContain("Key custody: Local (user-owned)");
    expect(text).toContain("15 Sept 2026, 12:00:00 UTC");
    expect(text).not.toContain("undefined");
    expect(text).not.toContain("\u001b");
  });

  it("shows useful empty states and pluralizes collections", () => {
    expect(walletsView([], false)).toBe("No delegated wallets found.");
    expect(sessionKeysView([], false)).toBe("No session keys found.");
    expect(executionsView({ items: [], nextCursor: null }, false)).toBe(
      "No confirmed executions found.",
    );
    expect(walletsView([wallet, wallet], false)).toContain("Found 2 delegated wallets:");
  });

  it("only invokes custom formatting for pretty mode", () => {
    const data = [{ amount: 123456789123456789n }];
    expect(formatValue(data, "json", { pretty: unexpectedPretty })).toEqual([
      '[{"amount":"123456789123456789"}]',
    ]);
    expect(formatValue(data, "ndjson", { pretty: unexpectedPretty })).toEqual([
      '{"amount":"123456789123456789"}',
    ]);
    expect(formatValue(wallet, "pretty", { pretty: walletView })).toEqual([
      walletView(wallet, false),
    ]);
    expect(walletView(wallet, true)).toContain("\u001b[1m");
  });

  it("does not claim queued operations are confirmed", () => {
    const pending = Schema.decodeUnknownSync(GetExecutionSubmissionResponse)({
      namespace: "eip155",
      submissionId: wallet.id,
      status: "prepared",
      userOperationHash: null,
    });
    const text = executionStatusView(pending, false);
    expect(text).toContain("Status: Prepared");
    expect(text).toContain("Not confirmed yet.");
    expect(text).toContain(`namera execution status ${wallet.id}`);
    const failed = Schema.decodeUnknownSync(GetExecutionSubmissionResponse)({
      namespace: "eip155",
      submissionId: wallet.id,
      status: "failed",
    });
    expect(executionStatusView(failed, false)).toContain("Execution failed");
    expect(executionStatusView(failed, false)).not.toContain("Check again");
  });

  it("makes invalid signatures unambiguous", () => {
    const result = Schema.decodeUnknownSync(VerifySignatureResponse)({
      namespace: "eip155",
      walletId: wallet.id,
      chainId: "eip155:1",
      account: wallet.address,
      type: "message",
      valid: false,
    });
    expect(verificationView(result, false)).toContain("Signature invalid\n  Valid: No");
  });

  it("renders dates and exact amounts without exposing DateTime internals", () => {
    expect(
      fields(
        [
          ["Created", DateTime.makeUnsafe("2026-09-15T12:00:00Z")],
          ["Amount", 999999999999999999999n],
        ],
        false,
      ),
    ).toContain("Amount: 999999999999999999999");
    expect(network("eip155:1")).toBe("Ethereum (eip155:1)");
    expect(
      recordView("MCP connection")(
        { apiOrigin: "http://localhost:8080", scopes: ["mcp:read"] },
        false,
      ),
    ).toContain("API Origin: http://localhost:8080");
  });

  it("neutralizes terminal escape sequences in names and nested values", () => {
    const malicious = "\u001b[2Jwallet\r\n\u001b]8;;https://example.com\u0007click\u001b]8;;\u0007";
    expect(terminalText(malicious)).toBe("wallet  click");
    const text = walletView(
      { ...wallet, metadata: { ...wallet.metadata, name: malicious } },
      false,
    );
    expect(text).not.toContain("\u001b");
    expect(text).not.toContain("https://example.com");
  });
});
