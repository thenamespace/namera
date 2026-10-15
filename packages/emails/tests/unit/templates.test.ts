import { Schema } from "effect";

import { Email } from "@namera-ai/protocol";
import { EmailJobPayload } from "@namera-ai/protocol/model";
import { render } from "react-email";
import { expect, it } from "vitest";

import { renderEmail } from "../../src/templates/render.js";

const to = Email.make("recipient@example.test");
const actionUrl = "https://example.test/review?token=synthetic";
const expiresAt = "2026-10-20T12:00:00Z";
const organizationName = "Research <script>alert(1)</script>";
const cases = [
  {
    type: "waitlist-confirmed",
    variables: {},
    expected: "Your place on the waitlist is confirmed.",
  },
  {
    type: "waitlist-accepted",
    variables: { inviteCode: "ABC234", invitationUrl: actionUrl, expiresAt },
    expected: "ABC234",
  },
  {
    type: "platform-invitation",
    variables: { invitationUrl: actionUrl, role: "operator", expiresAt },
    expected: "Operator",
  },
  {
    type: "connected-account-changed",
    variables: { provider: "Google", action: "disconnected", changedAt: expiresAt },
    expected: "Google sign-in has been removed",
  },
  {
    type: "magic-link",
    variables: { magicLinkUrl: actionUrl, code: "12345678", expiresInMinutes: 10 },
    expected: "12345678",
  },
  {
    type: "new-sign-in",
    variables: {
      actionUrl,
      ipAddress: "203.0.113.1",
      signedInAt: expiresAt,
      userAgent: "Test browser",
    },
    expected: "203.0.113.1",
  },
  {
    type: "organization-invitation",
    variables: {
      invitationUrl: actionUrl,
      organizationName,
      inviterName: "Test inviter",
      roleName: "Member",
      expiresAt,
    },
    expected: "Test inviter",
  },
  {
    type: "wallet-created",
    variables: {
      actionUrl,
      walletName: "Treasury",
      organizationName,
      address: "0x1111111111111111111111111111111111111111",
      addressUrl: "https://example.test/address",
      implementation: "alchemy-modular-v2",
      ownership: "User-owned passkey",
    },
    expected: "Treasury",
  },
  {
    type: "session-key-created",
    variables: {
      actionUrl,
      sessionKeyName: "Agent",
      walletName: "Treasury",
      organizationName,
      expiresAt,
    },
    expected: "Agent",
  },
  {
    type: "session-key-revoked",
    variables: {
      actionUrl,
      sessionKeyName: "Agent",
      walletName: "Treasury",
      organizationName,
      revokedGrantCount: 2,
    },
    expected: "2 grants",
  },
  {
    type: "api-key-created",
    variables: { actionUrl, apiKeyName: "Integration", organizationName, sessionKeyCount: 1 },
    expected: "1 session key",
  },
  {
    type: "api-key-revoked",
    variables: { actionUrl, apiKeyName: "Integration", organizationName, sessionKeyCount: 0 },
    expected: "0 session keys",
  },
] satisfies ReadonlyArray<Omit<EmailJobPayload, "to"> & { readonly expected: string }>;

it.each(cases)(
  "renders meaningful $type content and its actionable URL",
  async ({ expected, ...payload }) => {
    const input = Schema.decodeUnknownSync(EmailJobPayload)({ ...payload, to });
    const html = await render(renderEmail(input));
    const plainText = await render(renderEmail(input), { plainText: true });
    expect(plainText).toContain(expected);
    expect(html).not.toContain("<script>alert(1)</script>");
    if ("organizationName" in input.variables) {
      expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    }
    if (
      "actionUrl" in input.variables ||
      "invitationUrl" in input.variables ||
      "magicLinkUrl" in input.variables
    ) {
      expect(html).toContain(`href="${actionUrl}"`);
      expect(plainText).toContain(actionUrl);
    }
  },
);
