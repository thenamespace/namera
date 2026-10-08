import assert from "node:assert/strict";
import { test } from "node:test";

import { createElement } from "react";

import { WaitlistAcceptedEmail, WaitlistConfirmedEmail } from "@namera-ai/emails/templates";
import { render } from "react-email";

test("waitlist confirmation acknowledges signup without granting access", async () => {
  const html = await render(createElement(WaitlistConfirmedEmail));
  assert.ok(html.includes("Your place on the waitlist is confirmed."));
  assert.ok(html.includes("Visit Namera"));
  assert.ok(html.includes('href="https://namera.ai"'));
  assert.ok(!html.includes("Invite code"));
  assert.ok(!html.includes("If the button does not work"));
});

test("waitlist acceptance shows the invite, expiry and join link", async () => {
  const html = await render(
    createElement(WaitlistAcceptedEmail, WaitlistAcceptedEmail.PreviewProps),
  );
  assert.ok(html.includes("Invite code"));
  assert.ok(html.includes("ABC234"));
  assert.ok(html.includes("Use your invite before"));
  assert.ok(html.includes("Oct 15, 2026"));
  assert.ok(html.includes("Join Namera"));
  assert.ok(html.includes('href="https://dashboard.namera.ai/auth?invite=ABC234"'));
  assert.ok(html.includes("Sign in with the email address that received this invitation."));
  assert.ok(!html.includes("If the button does not work"));
});

test("waitlist acceptance escapes supplied code text", async () => {
  const html = await render(
    createElement(WaitlistAcceptedEmail, {
      ...WaitlistAcceptedEmail.PreviewProps,
      inviteCode: "<script>not-a-code</script>",
    }),
  );
  assert.ok(!html.includes("<script>not-a-code</script>"));
  assert.ok(html.includes("&lt;script&gt;not-a-code&lt;/script&gt;"));
});
