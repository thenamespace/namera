# Waitlist

The waitlist is a platform-level interest list, not an account or admission grant.
Addresses are unverified. Joining does not create a user, organization, session,
invite, or in-app notification. A new entry queues one `waitlist-confirmed` email.
The landing-page CTA posts to this endpoint
using the shared request/response schemas and `VITE_API_URL` (public build-time
configuration). It omits credentials, bounds requests to 15 seconds, prevents
duplicate in-flight submissions, and handles validation, rate-limit and network
errors without claiming a successful join. It does not call admin endpoints.

## API

- `POST /waitlist` accepts `{ "email": "person@example.com" }` publicly. It
  normalizes with the shared email schema, limits normalized addresses to 254
  characters, and returns HTTP 200 `{ "accepted": true }` for both new and
  existing addresses. No ID or status is disclosed.

- `GET /internal/waitlist`: all active admin roles; newest-first UUIDv7 cursor
  pagination (default 25, maximum 100), optional `pending`/`completed` status and
  literal case-insensitive email substring filters.
- `POST /internal/waitlist/:id/accept`: owner/operator; atomically issues a
  seven-day, single-use, email-bound beta invite, queues `waitlist-accepted`
  email, and marks the entry completed. Returns `{ accepted: false }` for missing
  or already-completed entries without issuing another code or email.

Internal routes require admin session authorization, are excluded from public
OpenAPI, and writes require an approved Origin and the admin write rate limit.
Public example:

```sh
curl --fail-with-body "$API_ORIGIN/waitlist" \
  -H 'Content-Type: application/json' --data '{"email":"person@example.com"}'
```

## Persistence and concurrency

See [auth catalog](../database/auth-core.md) and [audit catalog](../database/audit.md).
The unique normalized email constraint and conflict-do-nothing insert make
concurrent joins idempotent. Repeat joins never change status or timestamps.
Entry creation and encrypted confirmation enqueue share one transaction; an
enqueue failure rolls back the entry so a retry can complete both. The job uses
`waitlist-confirmed:<entry-id>` as its idempotency key and a one-day delivery
deadline. Delivery is asynchronous through the existing retrying outbox worker.
Existing entries, including completed entries, do not receive another confirmation
on repeat joins; this change does not backfill historical signups.
Existing entries and historical `audit.waitlist_events` and platform events are
preserved. Public joins deliberately have no separate audit event: the entry’s
creation timestamp records interest.

Acceptance takes the platform-team advisory lock and rechecks permission before
conditionally updating a pending entry. Invite issuance, encrypted email enqueue,
`audit.waitlist_events`, invite creation audit, and actor-attributed
`waitlist.accepted` platform audit (with waitlist/invite IDs) share one transaction.
Any failure rolls everything back. Competing requests cannot create extra invites.
Completed means the invitation is durably queued, not proof of provider delivery.
The existing outbox retries delivery; retries do not mint another invite. No user,
session, or organization is created until the recipient completes normal signup.
No in-app notification is created for an unregistered recipient.

## Transport and privacy

`WAITLIST_CORS_ORIGIN` optionally allows one landing-page origin on `POST
/waitlist` and its preflight only, without credentials. The existing dashboard
origin is also accepted there. Other routes retain dashboard-only CORS. CORS
does not authenticate callers or stop non-browser submissions.

Submission limits are 5 attempts per 15 minutes per connection IP and 500 per
hour globally, in addition to normal API transport limits. Counters are process-local; use one replica until the
shared limiter is implemented. Configure trusted ingress carefully before relying
on forwarded client IPs. No CAPTCHA or email verification is implemented.
Responses use the existing no-store security headers. Do not log request bodies,
admin authorization headers, response lists, or search query strings at ingress.
Decide retention and an operator deletion procedure before retaining addresses
indefinitely; no automated deletion or bulk export is implemented.

## Observability and verification

`namera.waitlist.joins` counts inserted entries, excluding duplicates.
`namera.waitlist.acceptances` counts committed acceptances; invite issuance also
increments `namera.beta_invite.transitions{result=created}`. No-op accepts count
neither. Route labels are bounded templates; email delivery uses existing outbox
telemetry. No addresses, codes, or invitation URLs enter telemetry attributes.

HTTP tests cover normalization, malformed inputs, duplicate and competing joins,
join metrics, no account creation, confirmation delivery and provider retry,
enqueue-failure rollback and per-IP limits. Management HTTP tests cover role/session/Origin
enforcement, competing accepts, outbox-failure rollback, provider retry,
bound invite/email delivery, audit and metrics,
literal search, status filters, and 25-row pagination. Run races in the disposable
PostgreSQL lane as well as PGlite. Separate transport tests verify route-specific
CORS and bounded metric labels.

The admin page uses the same UIKit table, copyable email display, filters and
pagination as Invites. Only pending entries expose Accept, gated by permission;
a confirmation explains issuance, email delivery and expiry. Acceptance invalidates
both waitlist and invite query caches. Provider delivery is asynchronous and is not
presented as already delivered. Bulk acceptance, resending and deletion are not implemented.
