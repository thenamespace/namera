# @namera-ai/emails

Typed email delivery through Resend hosted templates. Callers select a template
with `type`; TypeScript derives the required template variables from that value.

## Structure

- `src/config.ts` — Effect configuration for Resend and sender defaults.
- `src/data.ts` — closed template registry and provider message ID schema.
- `src/types.ts` — typed send input and template-variable schemas.
- `src/layer.ts` — `EmailService` and the Resend implementation.
- `src/index.ts` — public exports.

## Environment

| Variable         | Required | Purpose                                      |
| ---------------- | -------- | -------------------------------------------- |
| `RESEND_API_KEY` | Yes      | Resend API credential; loaded as `Redacted`. |
| `EMAIL_FROM`     | Yes      | Default sender accepted by Resend.           |
| `EMAIL_REPLY_TO` | No       | Default reply-to address.                    |

Set the hosted template ID in `src/data.ts` before sending that template.
Provider requests time out after ten seconds; this editable policy also lives in
`src/data.ts`.

## Usage

```ts
import { Effect } from "effect";
import { EmailService } from "@namera-ai/emails";

const sendMagicLink = Effect.gen(function* () {
  const email = yield* EmailService;

  return yield* email.send({
    type: "magic-link",
    to: recipient,
    idempotencyKey: verificationId,
    variables: {
      magicLinkUrl,
      code,
      expiresInMinutes: 10,
    },
  });
});

const EmailLive = EmailService.layer;
```

Do not add an untyped generic template payload. Register each template and its
variable schema in `src/data.ts` and `src/types.ts`.
