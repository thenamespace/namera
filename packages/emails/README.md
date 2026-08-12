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

## Adding an email

1. Create the hosted template in Resend.
2. Add its stable type, template ID, and Effect schema for variables to the
   registry. The `SendEmailProps` discriminated union must infer variables from
   `type`.
3. Call `EmailService.send` from an application workflow with an idempotency key
   tied to the durable operation when duplicate sends matter.
4. Map provider failures to `EmailError`; keep bounded timeout and retry policy
   near the provider layer. Do not retry indefinitely in request handlers.
5. Extend `testLayer` behavior only when tests need additional deterministic
   provider semantics.

Do not put JSX, generic HTML sending, business decisions, or authentication
tokens in this package. `developmentLayer` logs template variables for local
debugging and must not be used in shared or production environments.

`EmailService.testLayer` captures messages in `TestEmails` without contacting
Resend. Integration tests can inspect `TestEmails.latest` or `TestEmails.sent`
and clear captured messages between cases.

The protocol model and `jobs.email_jobs` persistence table for durable delivery
exist. The package job service, worker, bounded retries, and application enqueue
integration are not wired yet, so application delivery remains synchronous.
