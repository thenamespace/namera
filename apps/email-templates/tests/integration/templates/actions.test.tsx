import assert from "node:assert/strict";
import { test } from "node:test";

import { type ReactElement } from "react";

import {
  ApiKeyCreatedEmail,
  ApiKeyRevokedEmail,
  NewSignInEmail,
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
