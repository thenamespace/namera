# @namera-ai/emails

Durable, typed email delivery through Resend hosted templates. Application
workflows enqueue encrypted, provider-neutral payloads in PostgreSQL; the worker
claims and delivers them outside the request lifecycle.

## Structure

- `src/config.ts` — Effect configuration for Resend and sender defaults.
- `src/data.ts` — template IDs and bounded delivery policies.
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

Set the hosted template ID in `src/data.ts` before sending that template.
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
clear encrypted payload ciphertext.

The server runs the scoped worker after migrations complete. `processOnce` is
public for deterministic tests and explicit worker runtimes; request handlers
must not call it.

## Adding an email

1. Create the hosted template in Resend.
2. Add its stable type and variables to the `EmailJobPayload` discriminated
   union in `@namera-ai/protocol`.
3. Add its Resend template ID to `src/data.ts`.
4. Enqueue it from the owning application transaction with a stable business
   idempotency key and meaningful expiry.
5. Add delivery and retry tests through `EmailJobs.processOnce`.

Do not add an untyped generic payload, JSX, generic HTML sending, or business
decisions here. `developmentLayer` logs template variables for explicit local
debugging and must not be used in shared or production environments.

`EmailService.testLayer` captures messages in `TestEmails` without contacting
Resend. It can fail the next bounded number of sends for retry tests. Integration
tests can inspect `TestEmails.latest` or `TestEmails.sent` and clear captured
messages between cases.
