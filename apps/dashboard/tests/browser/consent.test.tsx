import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import { CliConsentForm } from "../../src/routes/_authenticated/cli/-components/cli-consent-form";
import { OAuthConsentForm } from "../../src/routes/_authenticated/oauth/-components/oauth-consent-form";
import {
  cliRequest,
  consentSession,
  oauthRequest,
  revokedConsentSession,
} from "../fixtures/consent.js";

vi.mock("../../src/components/display", async () => {
  const { MetadataDisplay } = await import("@namera-ai/ui");
  return { MetadataDisplay };
});

const mutations = vi.hoisted(() => ({
  approve: vi.fn(),
  deny: vi.fn(),
  approvePending: false,
  denyPending: false,
  completeApproval: () => {},
  completeDenial: () => {},
}));

vi.mock("../../src/hooks/auth", () => ({
  useApproveOAuthAuthorizationRequest: () => ({
    mutate: mutations.approve,
    isPending: mutations.approvePending,
  }),
  useDenyOAuthAuthorizationRequest: () => ({
    mutate: mutations.deny,
    isPending: mutations.denyPending,
  }),
  useApproveOAuthDeviceAuthorization: (options: { onSuccess: () => void }) => {
    mutations.completeApproval = options.onSuccess;
    return { mutate: mutations.approve, isPending: mutations.approvePending };
  },
  useDenyOAuthDeviceAuthorization: (options: { onSuccess: () => void }) => {
    mutations.completeDenial = options.onSuccess;
    return { mutate: mutations.deny, isPending: mutations.denyPending };
  },
}));

beforeEach(() => {
  mutations.approve.mockReset();
  mutations.deny.mockReset();
  mutations.approvePending = false;
  mutations.denyPending = false;
});

const revokedSession = revokedConsentSession;

for (const kind of ["oauth", "cli"] as const) {
  describe(`${kind} consent`, () => {
    const requestIdentity =
      kind === "oauth" ? { requestId: oauthRequest.id } : { deviceAuthorizationId: cliRequest.id };

    function form(canAuthorize = true, sessionKeys = [consentSession, revokedSession]) {
      const props = { canAuthorize, organizationId: consentSession.organizationId, sessionKeys };
      return kind === "oauth" ? (
        <OAuthConsentForm {...props} request={oauthRequest} />
      ) : (
        <CliConsentForm {...props} request={cliRequest} />
      );
    }

    it("requires explicit active-key selection and submits the reviewed request identity", async () => {
      await render(form());

      await expect
        .element(page.getByRole("heading", { name: "Review client is requesting access" }))
        .toBeVisible();
      await expect
        .element(page.getByText("Read wallets and account details", { exact: true }))
        .toBeVisible();
      if (kind === "cli") {
        await expect.element(page.getByText(cliRequest.userCode, { exact: true })).toBeVisible();
      } else {
        await expect
          .element(page.getByText(oauthRequest.redirectUri, { exact: true }))
          .toBeVisible();
      }
      expect(mutations.approve).not.toHaveBeenCalled();
      await page.getByRole("button", { name: "Approve access" }).click();
      await expect.element(page.getByRole("alert")).toBeVisible();
      expect(mutations.approve).not.toHaveBeenCalled();

      await page.getByRole("button", { name: /Accounts and session keys/ }).click();
      await expect
        .element(page.getByRole("option", { name: /Revoked session/ }))
        .not.toBeInTheDocument();
      await page.getByRole("option", { name: /Trading session/ }).click();
      await userEvent.keyboard("{Escape}");
      await page.getByRole("button", { name: "Approve access" }).click();

      await expect
        .poll(() => mutations.approve.mock.calls)
        .toEqual([
          [
            {
              payload: {
                ...requestIdentity,
                organizationId: consentSession.organizationId,
                sessionKeyIds: [consentSession.id],
                ...(kind === "oauth" ? { expiresAt: null } : {}),
              },
            },
          ],
        ]);
      expect(mutations.deny).not.toHaveBeenCalled();
      if (kind === "cli") {
        await expect
          .element(page.getByRole("heading", { name: "CLI authorized" }))
          .not.toBeInTheDocument();
        mutations.completeApproval();
        await expect.element(page.getByRole("heading", { name: "CLI authorized" })).toBeVisible();
      }
    });

    it.each(["role", "no active sessions"])(
      "blocks approval for %s while preserving rejection",
      async (reason) => {
        await render(
          form(reason !== "role", reason === "role" ? [consentSession] : [revokedSession]),
        );
        await expect.element(page.getByRole("button", { name: "Approve access" })).toBeDisabled();
        await page.getByRole("button", { name: "Reject", exact: true }).click();
        expect(mutations.deny).toHaveBeenCalledExactlyOnceWith({ payload: requestIdentity });
        expect(mutations.approve).not.toHaveBeenCalled();
        if (kind === "cli") {
          mutations.completeDenial();
          await expect
            .element(page.getByRole("heading", { name: "Request rejected" }))
            .toBeVisible();
        }
      },
    );

    it.each(["approve", "deny"])("blocks both decisions while %s is pending", async (pending) => {
      mutations.approvePending = pending === "approve";
      mutations.denyPending = pending === "deny";
      await render(form());
      await expect
        .element(
          page.getByRole("button", {
            name: pending === "approve" ? "Approving…" : "Approve access",
          }),
        )
        .toBeDisabled();
      await expect
        .element(page.getByRole("button", { name: "Reject", exact: true }))
        .toBeDisabled();
      expect(mutations.approve).not.toHaveBeenCalled();
      expect(mutations.deny).not.toHaveBeenCalled();
    });
  });
}
