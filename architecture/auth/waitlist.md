# Waitlist

The waitlist is a platform-level interest list, not an account or admission grant.
Addresses are unverified. Joining does not create a user, organization, session,
invite, notification, or email job. The landing-page CTA posts to this endpoint
using the shared request/response schemas and `VITE_API_URL` (public build-time
configuration). It omits credentials, bounds requests to 15 seconds, prevents
duplicate in-flight submissions, and handles validation, rate-limit and network
errors without claiming a successful join. It does not call admin endpoints.

## API

- `POST /waitlist` accepts `{ "email": "person@example.com" }` publicly. It
  normalizes with the shared email schema, limits normalized addresses to 254
  characters, and returns HTTP 200 `{ "accepted": true }` for both new and
  existing addresses. No ID or status is disclosed.

The internal list/status APIs and their dedicated workflows, audit emitters, and
metrics have been removed for the portal rebuild. There is no management API at
present. Admin authentication and team management remain intact. Public example:

```sh
curl --fail-with-body "$API_ORIGIN/waitlist" \
  -H 'Content-Type: application/json' --data '{"email":"person@example.com"}'
```

## Persistence and concurrency

See [auth catalog](../database/auth-core.md) and [audit catalog](../database/audit.md).
The unique normalized email constraint and conflict-do-nothing insert make
concurrent joins idempotent. Repeat joins never change status or timestamps.
Existing entries and historical `audit.waitlist_events` and platform events are
preserved. Public joins deliberately have no separate audit event: the entry’s
creation timestamp records interest. No new status or platform audit events are
emitted by this feature.

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

`namera.waitlist.joins` counts inserted entries, excluding duplicates. The status
change counter and management route labels are removed. Unknown/retired routes
use the bounded `/*` telemetry label. No payload logs are added.

HTTP tests cover normalization, malformed inputs, duplicate and competing joins,
join metrics, no account/email side effects, per-IP limits, and 404 responses for
retired management routes. Separate transport tests verify route-specific CORS
and bounded metric labels. Existing migrations and data remain unchanged.
