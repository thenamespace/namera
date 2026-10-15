# @namera-ai/emails

Typed React Email templates and durable delivery through Resend. Workflows enqueue
encrypted jobs in PostgreSQL; a scoped worker renders and sends them independently
of the request that created them.

## Use

Call `EmailJobs.enqueue` inside the business transaction with a discriminated
template payload, stable idempotency key and expiry. `EmailService` is the delivery
adapter, not an application-facing shortcut. `EmailJobs.processOnce` supports
explicit worker execution and deterministic integration tests.

Templates live in `src/templates/`; subjects and retry limits in `src/data.ts`.
The `./templates` export supports the preview app. Adding a template requires a
protocol payload variant, rendering case and code-owned subject.

## Configuration

| Variable         | Purpose                                                |
| ---------------- | ------------------------------------------------------ |
| `RESEND_API_KEY` | Required live delivery credential, loaded as redacted. |
| `EMAIL_FROM`     | Required live sender.                                  |
| `EMAIL_REPLY_TO` | Optional reply-to address.                             |

Jobs also require [crypto configuration](../crypto/README.md). The server selects
`EmailService.devLayer` in development and the live layer otherwise. The development
layer logs template variables and is unsuitable for shared or production use.
`testLayer` captures messages without sending.

## Delivery

Claims use token-owned leases and skip locked rows. Sends have a ten-second timeout,
five attempts and capped exponential backoff. Expiry and cancellation prevent
obsolete pending delivery; terminal jobs clear encrypted payloads. Provider
idempotency protects retries but does not revoke already delivered links.

```sh
pnpm --filter @namera-ai/emails typecheck
pnpm --filter @namera-ai/emails typecheck:test
pnpm --filter @namera-ai/emails test
pnpm --filter @namera-ai/emails build
```

See [notifications and email](../../architecture/services/notifications.md) for
transaction and preference boundaries.
