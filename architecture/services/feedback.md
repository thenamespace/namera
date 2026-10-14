# Feedback

Authenticated dashboard users submit a category and typed feedback payload with
their current organization context. The server derives user and session identity;
the browser does not choose the author. Optional page context is a local pathname,
not a full URL with query parameters or fragments.

Creation inserts `core.feedback` and a user audit event in one transaction. The
response returns the feedback ID. Categories are `bug`, `feature_request`, and
`general`.

Platform administrators read and triage feedback through `/internal` routes.
Statuses are `new`, `in_review`, `planned`, `completed`, and `closed`. A changed
status creates a platform audit event in the same transaction; a no-op status
update does not. The write locks platform membership before rechecking authority.

Feedback is not an automated support conversation or issue-tracker integration.

## Source

- [Workflow](../../packages/application/src/feedback/index.ts)
- [Table](../../packages/database/src/schema/core/feedback.ts)
