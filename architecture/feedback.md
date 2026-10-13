# Feedback

Feedback is private product correspondence from a verified dashboard user to the
platform team. It is not an organization-owned support ticket or public discussion.
The [table catalog](database/feedback.md) describes persistence.

`POST /feedback` accepts `category`, `data: { version: 1, message }`, and an optional
`pagePath`. The message is trimmed and limited to 1–5,000 characters. Only local
pathnames without query strings or fragments are accepted. Unknown data versions
are rejected. Attachments are not implemented; future versions extend the typed
data union without adding content columns.

The route requires a verified user actor with active organization membership,
the exact dashboard Origin, and at most ten attempts per user per hour. User,
session, and organization IDs come from authorization, never the payload. Machine
actors cannot submit. Rate limits use the existing process-local store.

Creation and an ID-only `feedback.created` user audit event share one transaction.
Messages and page paths are not copied into logs, analytics, or audit events.
No email or inbox notification is sent.

All active platform roles have `feedback:read` for `GET /internal/feedback` and
`GET /internal/feedback/:id`. Lists have category/status filters, a default page
size of 25 (maximum 100), and descending UUIDv7 cursor pagination. They join the
current user and organization display metadata; no name or email snapshot is stored.
Only the platform owner has `feedback:manage` for
`PATCH /internal/feedback/:id/status`. Status is `new`, `in_review`, `planned`,
`completed`, or `closed`; reopening is allowed. Repeating the current status is
a no-op. Changes take the platform team lock, recheck session and permission,
and append an ID/status-only platform audit event in the same transaction.
All endpoints are excluded from public OpenAPI; no SDK or CLI workflow is added.

The server integration suite covers persisted data and attribution, role separation,
revoked access, exact origins, validation, pagination, limits, missing records,
and rollback when either audit write fails. Normal startup applies the migration.
