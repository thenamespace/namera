# @namera-ai/emails

Durable, typed email delivery through code-owned React Email templates and
Resend. Application workflows enqueue encrypted, provider-neutral payloads in
PostgreSQL; the worker claims and delivers them outside the request lifecycle.

See [Durable email delivery](../../architecture/notifications/email-delivery.md)
for the outbox schema, encryption, lease, retry, and provider flow, and
[delivery workspace architecture](../../architecture/packages/delivery.md) for
the package's repository role.

## Structure

- `src/config.ts` — Effect configuration for Resend and sender defaults.
- `src/data.ts` — default subjects and bounded delivery policies.
- `src/templates/` — runtime React Email templates, components, theme, assets,
  and helpers.
- `src/types.ts` — enqueue and provider-send input types.
- `src/layer.ts` — internal provider adapter and live/development/test layers.
- `src/jobs.ts` — public `EmailJobs` enqueue and single-job processing service.
- `src/worker.ts` — scoped background polling worker.
- `src/index.ts` — public exports.

## Environment

| Variable         | Required | Purpose                                      |
| ---------------- | -------- | -------------------------------------------- |
| `RESEND_API_KEY` | Yes      | Resend API credential; loaded as `Redacted`. |
| `EMAIL_FROM`     | Yes      | Default sender accepted by Resend.           |
| `EMAIL_REPLY_TO` | No       | Default reply-to address.                    |

Provider requests time out after ten seconds; this editable policy also lives in
`src/data.ts`. Durable payload encryption also requires the shared configuration
documented by `@namera-ai/crypto`; the server composition root provides it.

## Usage

```ts
import { EmailJobs } from "@namera-ai/emails";
import { Effect } from "effect";

const enqueueMagicLink = Effect.gen(function* () {
  const emails = yield* EmailJobs;

  return yield* emails.enqueue({
    type: "magic-link",
    to: recipient,
    idempotencyKey: verificationId,
    expiresAt: verificationExpiresAt,
    variables: {
      magicLinkUrl,
      code,
      expiresInMinutes: 10,
    },
  });
});
```

Enqueue the job inside the same `TransactionService.run` boundary as the state
change that requires it. This gives the workflow transactional outbox semantics:
either both records commit or neither does.

`EmailService` is the provider adapter used by `EmailJobs` and the server
composition root. Application workflows must use `EmailJobs.enqueue`, not call
the provider directly.

## Delivery

The worker uses atomic `FOR UPDATE SKIP LOCKED` claims and lease-conditional
state transitions so multiple worker instances can share the table. Delivery
has a ten-second provider timeout, five total attempts, capped exponential
backoff, stale-lease recovery, job expiry, and Resend idempotency. Terminal jobs
clear encrypted payload ciphertext. A pending job can also be canceled by its
business idempotency key when the source action is resolved before delivery.

The server runs the scoped worker after migrations complete. `processOnce` is
public for deterministic tests and explicit worker runtimes; request handlers
must not call it.

Registered templates include session-key lifecycle delivery for creation and
revocation. Revocation emails report the affected account and number of grants
disabled without exposing policy or credential payloads.

## Adding an email

1. Add its stable type and variables to the `EmailJobPayload` discriminated
   union in `@namera-ai/protocol`.
2. Add its code-owned React Email component and rendering case under
   `src/templates/`, plus its default subject in `src/data.ts`.
3. Keep payload values semantic and perform presentation-only formatting in the
   React component. Construct action and explorer URLs in the owning application
   workflow.
4. Enqueue it from the owning application transaction with a stable business
   idempotency key and meaningful expiry.
5. Add delivery and retry tests through `EmailJobs.processOnce`.

Do not add an untyped generic payload, generic HTML sending, or business
decisions to templates. `EmailService.devLayer` logs template variables for
explicit local debugging and must not be used in shared or production
environments.

`EmailService.testLayer` captures messages in `TestEmails` without contacting
Resend. It can fail the next bounded number of sends for retry tests. Integration
tests can inspect `TestEmails.latest` or `TestEmails.sent` and clear captured
messages between cases.
