import { Schema } from "effect";

import { WalletId } from "@namera-ai/protocol";
import { CurrentActorResponse } from "@namera-ai/protocol/dto";
import { describe, expect, it } from "vitest";

import { formatValue } from "../../src/services/output.js";
import {
  authView,
  loginInstructionsView,
  loginView,
  logoutView,
} from "../../src/services/output/auth.js";

const id = "01950000-0000-7000-8000-000000000001";
const createdAt = new Date("2026-09-15T12:00:00Z");
const key = {
  id,
  organizationId: id,
  walletId: id,
  signingKeyId: id,
  createdByActorId: id,
  metadata: { version: 1, name: "Trading bot" },
  policyHash: "test",
  status: "active",
  revokedAt: null,
  revokedByActorId: null,
  createdAt,
  namespace: "eip155",
  policies: [],
};
const grant = {
  id,
  organizationId: id,
  actorId: id,
  sessionKeyId: id,
  grantedByActorId: id,
  revokedAt: null,
  revokedByActorId: null,
  createdAt,
};
const actor = Schema.decodeUnknownSync(CurrentActorResponse)({
  type: "cli",
  data: {
    actorId: id,
    organizationId: id,
    organizationName: "Personal",
    grants: [
      { grant, sessionKey: key },
      { grant, sessionKey: { ...key, metadata: { version: 1, name: "Savings bot" } } },
    ],
    authorization: {
      id,
      clientId: id,
      scopes: ["wallet:read", "execution:execute", "offline_access"],
      metadata: {
        type: "cli",
        version: 1,
        deviceName: "Laptop",
        cliVersion: "1.0.3",
        platform: "test",
      },
      expiresAt: null,
      lastUsedAt: null,
      createdAt,
    },
  },
});
const value = {
  profile: "personal",
  actor,
  wallets: [{ id: WalletId.make(id), metadata: { version: 1 as const, name: "Trading Account" } }],
};

describe("friendly authentication output", () => {
  it("groups keys under wallet names and translates scopes without internal IDs", () => {
    const text = authView(value, false);
    expect(text).toContain("Organization: Personal");
    expect(text).toContain("View wallets");
    expect(text).toContain("Send transactions");
    expect(text).toContain("Stay signed in");
    expect(text.match(/Trading Account/g)).toHaveLength(1);
    expect(text).toContain("\nProfile: personal\nOrganization: Personal");
    expect(text).toContain("\nPermissions\n-> View wallets");
    expect(text).toContain(
      "\nTrading Account\n-> Trading bot | Active | Expiry unavailable\n-> Savings bot | Active | Expiry unavailable",
    );
    expect(text).not.toMatch(/wallet:read|Expires:|Authorization ID/);
    expect(text).not.toContain("\u001b");
    expect(text).not.toContain(id);
    expect(authView(value, true)).toContain("\u001b[32mActive");
    expect(authView(value, true)).toContain("\u001b[36mPermissions");
    expect(authView(value, true)).toContain("\u001b[36mProfile:");
    expect(authView(value, true)).toContain("\u001b[35mTrading Account");
  });
  it("separates flush-left account groups with a blank line", () => {
    if (actor.type !== "cli") throw new Error("Expected CLI fixture");
    const otherWallet = WalletId.make("01950000-0000-7000-8000-000000000002");
    const firstGrant = actor.data.grants[0];
    if (!firstGrant) throw new Error("Expected grant fixture");
    const text = authView(
      {
        ...value,
        wallets: [...value.wallets, { id: otherWallet, metadata: { version: 1, name: "Savings" } }],
        actor: {
          ...actor,
          data: {
            ...actor.data,
            grants: [
              firstGrant,
              {
                ...firstGrant,
                sessionKey: { ...firstGrant.sessionKey, walletId: otherWallet },
              },
            ],
          },
        },
      },
      false,
    );
    expect(text).toContain(
      "Trading Account\n-> Trading bot | Active | Expiry unavailable\n\nSavings\n-> Trading bot | Active | Expiry unavailable",
    );
  });
  it("retains full authorization and grant records in JSON", () => {
    const json = JSON.parse(formatValue({ profile: value.profile, actor }, "json")[0] ?? "");
    expect(json.actor.data.authorization.id).toBe(id);
    expect(json.actor.data.grants[0].sessionKey.walletId).toBe(id);
    expect(json.actor.data.authorization.scopes).toContain("wallet:read");
  });
  it("makes browser instructions and successful local logout explicit", () => {
    expect(
      loginInstructionsView(
        { url: "https://dashboard.namera.ai/cli/authorize", code: "ABCD-1234" },
        false,
      ),
    ).toContain("Confirm this code: ABCD-1234");
    expect(loginView({ profile: "personal" }, true)).toContain("\u001b[32m");
    const logout = logoutView({ profile: "personal" }, false);
    expect(logout).toContain('Signed out of "personal" on this device.');
    expect(logout).toContain("Your imported keys are still saved.");
    expect(logout).not.toContain("revoked");
  });
  it("sanitizes profile names and handles missing names without guessing", () => {
    expect(loginView({ profile: "bad\u001b[2J\nname" }, false)).not.toContain("\u001b");
    if (actor.type !== "cli") throw new Error("Expected CLI fixture");
    const { organizationName: _, ...data } = actor.data;
    const text = authView(
      { profile: "old-server", actor: { type: "cli", data: { ...data, grants: [] } } },
      false,
    );
    expect(text).toContain("Name unavailable");
    expect(text).toContain("No session keys shared");
  });
});
