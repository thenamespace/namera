import { DateTime, Schema } from "effect";

import { WalletId, SessionKeyId } from "@namera-ai/protocol";
import {
  WalletOwnerResponse,
  GetExecutionSubmissionResponse,
  SessionKeyResponse,
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
    data: Schema.Struct({ validatorType: Schema.Literal("webauthn_p256") }),
    createdAt: Schema.DateTimeUtcFromDate,
  }),
)({
  id: "01950000-0000-7000-8000-000000000001",
  metadata: { version: 1, name: "Trading Account", logo: { type: "emoji", value: "💳" } },
  status: "active",
  namespace: "eip155",
  data: { validatorType: "webauthn_p256" },
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
    expect(text).toContain("Sepolia | Pending\nNot enabled yet.");
    expect(text).toContain("-> Expires:");
    expect(text).toContain("-> Message signing: Allowed");
    expect(text).toContain("Unrestricted account access");
    expect(text).toContain("API Policies\n-> None");
    expect(text).toMatch(/^Trading bot \| Pending\n\n-> Account: Trading Account\n/);
    expect(text).toContain("-> Networks: None installed");
    expect(text).toContain("\n\nPermissions\n\n");
    expect(text).not.toContain("ID:");
    expect(text).not.toContain("Version:");
    const policies = Schema.decodeUnknownSync(SessionKeyResponse.members[0].fields.policies)([
      {
        type: "evm.signature",
        version: 1,
        id: wallet.id,
        appliesTo: "signature",
        allowedTypes: ["message"],
      },
    ]);
    const policyText = sessionKeyView({ ...key, policies }, false);
    expect(policyText).toContain("API Policies\n-> Signature");
    expect(policyText).toContain("Allowed Types: message");
    expect(policyText).not.toContain(wallet.id);
    expect(policyText).not.toContain("Version:");
    expect(text).not.toContain("eip155:");
    expect(text).not.toContain("Policy:");
    const limited = sessionKeyView(
      {
        ...key,
        installations: [
          {
            ...installation,
            authorization: {
              ...installation.authorization,
              permissions: [{ type: "native-token-transfer", allowance: 999999999999999999999n }],
            },
          },
        ],
      },
      false,
    );
    expect(limited).toContain("Allowance: 999999999999999999999");
    expect(limited).toContain("Unit: wei");
    expect(limited).not.toContain("Unrestricted account access");
    const multipleNetworks = sessionKeyView(
      {
        ...key,
        status: "active",
        installations: [
          { ...installation, status: "installed" },
          {
            ...installation,
            chainId: "eip155:8453",
            authorization: {
              ...installation.authorization,
              validUntil: 1800003600,
            },
          },
        ],
      },
      false,
    );
    expect(multipleNetworks).toContain("-> Networks: Sepolia\n");
    expect(multipleNetworks).toContain("-> Expires: Varies by network (see below)");
    expect(multipleNetworks).toContain("Base | Pending\nNot enabled yet.");
    expect(sessionKeysView([key], false)).toContain(
      "💳 Trading Account\n\nTrading bot | Pending |",
    );
    expect(sessionKeysView([key], false)).toContain("-> Networks: None active");
    const listed = sessionKeysView(
      [
        {
          ...key,
          status: "active",
          installations: [
            {
              ...installation,
              status: "installed",
              authorization: {
                ...installation.authorization,
                validUntil: Math.floor(Date.now() / 1000) + 86400,
              },
            },
            { ...installation, chainId: "eip155:8453" },
            {
              ...installation,
              chainId: "eip155:1",
              status: "installed",
              authorization: { ...installation.authorization, validUntil: 1 },
            },
          ],
        },
        { ...key, metadata: { version: 1, name: "Second key" } },
      ],
      false,
    );
    expect(listed).toContain("-> Networks: Sepolia\n\nSecond key | Pending |");
    expect(listed).not.toContain("eip155:");
    expect(listed).not.toContain("Base");
    expect(listed).not.toContain("Ethereum");
    expect(sessionKeysView([key], false)).not.toContain("Onchain permissions");
  });
  it("leads with the wallet name and preserves copyable identifiers", () => {
    const text = walletsView([wallet], false);
    expect(text).toContain("Found 1 delegated wallet:");
    expect(text).toContain("💳 Trading Account | Active");
    expect(text).toContain(`\n-> Address: ${wallet.address}`);
    expect(text).toContain("\n-> Network type: EVM");
    expect(text).toContain("\n-> Custody: User-owned passkey");
    expect(text).toContain("\n-> Created: ");
    expect(text).not.toContain("\n  Address:");
    expect(text).not.toContain(wallet.id);
    expect(text).not.toContain("Implementation");
    expect(text).toContain("15 Sept 2026, 12:00:00 UTC");
    expect(text).not.toContain("undefined");
    expect(text).not.toContain("\u001b");
  });

  it("distinguishes managed custody and user-owned keys from passkeys", () => {
    expect(
      walletView(
        {
          ...wallet,
          owner: { ...wallet.owner, custody: "namera-managed", protectionLevel: "software" },
        },
        false,
      ),
    ).toContain("-> Custody: Namera-managed");
    const localKey = walletView(
      {
        ...wallet,
        data: { validatorType: "ecdsa_secp256k1" },
      },
      false,
    );
    expect(localKey).toContain("-> Custody: User-owned key");
    expect(localKey).not.toContain("User-owned passkey");
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
