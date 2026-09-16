# Waitlist

The waitlist is a platform-level interest list, not an account or admission grant.
Addresses are unverified. Joining does not create a user, organization, session,
invite, notification, or email job. The landing-page form is not wired yet.

## API

- `POST /waitlist` accepts `{ "email": "person@example.com" }` publicly. It
  normalizes with the shared email schema, limits normalized addresses to 254
  characters, and returns HTTP 200 `{ "accepted": true }` for both new and
  existing addresses. No ID or status is disclosed.
- `GET /internal/waitlist` requires `AdminAuthorization`. Optional query fields:
  `limit` (1–100, default 50), `cursor` (last entry ID), `status` (`pending` or
  `completed`), and `search` (case-insensitive literal email substring, max 254
  characters). It returns `{ entries, nextCursor }`. Entries are ordered by
  descending UUIDv7 ID; null cursor means the end. Keep filters unchanged while
  paging. This is a live list, not a snapshot across requests.
- `PATCH /internal/waitlist/:id` requires `AdminAuthorization` and accepts
  `{ "status": "completed" }` or `{ "status": "pending" }`. It returns the
  entry, or 404 `WAITLIST_NOT_FOUND`. Completed means an operator handled the
  entry, not that the person signed up. Reopening clears `completedAt`.

Use `Authorization: Bearer <ADMIN_TOKEN>` from a trusted operator environment.
Never expose that credential in the website. Example commands:

```sh
curl --fail-with-body "$API_ORIGIN/waitlist" \
  -H 'Content-Type: application/json' --data '{"email":"person@example.com"}'
curl --fail-with-body "$API_ORIGIN/internal/waitlist?status=pending&limit=50" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
curl --fail-with-body -X PATCH "$API_ORIGIN/internal/waitlist/$ENTRY_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data '{"status":"completed"}'
```

## Persistence and concurrency

See [auth catalog](../database/auth-core.md) and [audit catalog](../database/audit.md).
The unique normalized email constraint and conflict-do-nothing insert make
concurrent joins idempotent. Repeat joins never change status or timestamps.
Status changes lock the entry and append `audit.waitlist_events` in the same
transaction. Identical updates leave timestamps, audit, and counters unchanged.
Public joins deliberately have no separate audit event: the entry's creation
timestamp records admission to this unverified interest list. No tenant actor
is fabricated for shared-token admin changes.

## Transport and privacy

`WAITLIST_CORS_ORIGIN` optionally allows one landing-page origin on `POST
/waitlist` and its preflight only, without credentials. The existing dashboard
origin is also accepted there. Other routes retain dashboard-only CORS. CORS
does not authenticate callers or stop non-browser submissions.

Submission limits are 5 attempts per 15 minutes per connection IP and 500 per
hour globally, in addition to normal API transport limits. Admin endpoints use
the shared admin limits. Counters are process-local; use one replica until the
shared limiter is implemented. Configure trusted ingress carefully before relying
on forwarded client IPs. No CAPTCHA or email verification is implemented.
Responses use the existing no-store security headers. Do not log request bodies,
admin authorization headers, response lists, or search query strings at ingress.
Decide retention and an operator deletion procedure before retaining addresses
indefinitely; no automated deletion or bulk export is implemented.

## Observability and verification

`namera.waitlist.joins` counts inserted entries, excluding duplicates.
`namera.waitlist.status_changes` counts real transitions with only the bounded
destination `status` label. Updates occur after the workflow's database write or
transaction succeeds. Existing HTTP request and duration metrics use `/waitlist`,
`/internal/waitlist`, and `/internal/waitlist/:id`, never email queries or IDs.
Workflow/repository spans use stable names; no payload logs were added.

HTTP tests cover normalization, malformed inputs, duplicate and competing joins,
status transitions and idempotency, audit rows, metrics, pagination, filtering,
missing/wrong admin credentials, no account/email side effects, and per-IP limits.
Separate transport tests verify route-specific CORS and bounded metric labels.
The generated migration runs through the normal startup and test migrators.
