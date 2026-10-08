import assert from "node:assert/strict";
import { test } from "node:test";

import { createElement, type ReactElement } from "react";

import {
  ApiKeyCreatedEmail,
  ApiKeyRevokedEmail,
  NewSignInEmail,
  MagicLinkEmail,
  OrganizationInvitationEmail,
  SessionKeyCreatedEmail,
  SessionKeyRevokedEmail,
  WalletCreatedEmail,
} from "@namera-ai/emails/templates";
import { render } from "react-email";

const checkActions = <Props extends { actionUrl?: string }>(
  component: ((props: Props) => ReactElement) & { PreviewProps: Props },
  label: string,
) => {
  test(`${component.name} includes its dashboard action and X social link`, async () => {
    const html = await render(component(component.PreviewProps));
    assert.ok(html.includes(label));
    assert.ok(!html.includes("If the button does not work"));
    assert.ok(html.includes(`href="${component.PreviewProps.actionUrl}"`));
    assert.ok(html.includes("https://x.com/namera_ai"));
    assert.ok(html.includes("https://cdn.namera.ai/email-assets/social/x-light.png"));
    assert.ok(html.includes("https://cdn.namera.ai/email-assets/social/x-dark.png"));
    assert.ok(!html.includes("<svg"));
  });

  test(`${component.name} still renders older queued payloads without an action URL`, async () => {
    const legacy = { ...component.PreviewProps };
    delete legacy.actionUrl;
    const html = await render(component(legacy));
    assert.ok(!html.includes(label));
    assert.ok(!html.includes('href="undefined"'));
    assert.ok(html.includes("Namera"));
  });
};

checkActions(ApiKeyCreatedEmail, "View API keys");
checkActions(ApiKeyRevokedEmail, "View API keys");
checkActions(NewSignInEmail, "Review sign-ins");
checkActions(SessionKeyCreatedEmail, "View session key");
checkActions(SessionKeyRevokedEmail, "View session key");
checkActions(WalletCreatedEmail, "View account");

test("API-key creation notice focuses on reviewing unrecognized activity", async () => {
  const html = await render(createElement(ApiKeyCreatedEmail, ApiKeyCreatedEmail.PreviewProps));
  assert.ok(html.includes("If you do not recognize this activity"));
  assert.ok(!html.includes("The API key secret is never sent by email"));
});

test("only magic-link sign-in retains the fallback URL", async () => {
  const magicLink = await render(createElement(MagicLinkEmail, MagicLinkEmail.PreviewProps));
  assert.ok(magicLink.includes("If the button does not work"));
  const invitation = await render(
    createElement(OrganizationInvitationEmail, OrganizationInvitationEmail.PreviewProps),
  );
  assert.ok(!invitation.includes("If the button does not work"));
});

test("X renders smaller than the other footer icons", async () => {
  const html = await render(createElement(ApiKeyCreatedEmail, ApiKeyCreatedEmail.PreviewProps));
  const images = html.match(/<img\b[^>]*>/g) ?? [];
  const xImages = images.filter((image) => image.includes("/social/x-"));
  assert.equal(xImages.length, 2);
  for (const image of xImages) {
    assert.ok(image.includes('width="14"'));
    assert.ok(image.includes('height="14"'));
  }
});
