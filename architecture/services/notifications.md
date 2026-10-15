# Notifications and email

Notifications are durable occurrences with a fixed recipient set. Application
workflows create the occurrence and recipients in the business transaction;
historical inbox visibility is not recomputed from current organization membership.

## Inbox and preferences

An occurrence has a typed payload, resource reference, correlation ID, and unique
business idempotency key. Recipient rows hold read/archive state and an optional
email-job reference. Inbox reads are scoped to the authenticated recipient.

Preferences affect email, not in-app delivery. Resolution order is an
organization-specific category/topic override, then the user's global override,
then the notification type's default. The application policy maps each type to
its category and topic. Email is queued only when the workflow supplies a template
and the resolved preference permits it.

## Email outbox

`EmailJobs.enqueue` validates a typed template payload, encrypts it, and inserts
an idempotent job in the same transaction as the originating change. The HTTP
request does not call Resend or wait for delivery.

The worker claims jobs with `FOR UPDATE SKIP LOCKED` and a thirty-second lease.
Lease-owned transitions prevent stale workers from overwriting current state.
Provider requests time out after ten seconds. Delivery permits five attempts
with exponential retry from five seconds, capped at five minutes. Resend receives
an idempotency key. Expired, canceled, and completed jobs discard ciphertext.

Templates are code-owned React Email components. Authentication proofs and team
invitation links can be inside encrypted payloads, so the development email layer
that logs variables is suitable only for local debugging. Production uses the
Resend adapter. Notification policy does not suppress direct authentication email
jobs needed to complete sign-in.

## Source

- [Notification workflows and policy](../../packages/application/src/notification/)
- [Email jobs](../../packages/emails/src/jobs.ts)
- [Worker policy](../../packages/emails/src/data.ts)
- [Persistence](../data/notifications.md)

API-key creation notifications and email accept zero session grants for
management-only keys. Their typed payloads include the issued management
permissions; historical payloads without that field remain readable. Audit records
also preserve permissions and approved passkey origins from issuance.
