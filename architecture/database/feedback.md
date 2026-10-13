# Feedback table

`core.feedback` stores private platform feedback. Source:
`packages/database/src/schema/core/feedback.ts`.

| Column                     | Definition                                                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `id`                       | Required text primary key, generated UUIDv7                                                                     |
| `user_id`                  | Required FK to `auth.user.id`, delete restrict                                                                  |
| `organization_id`          | Nullable FK to `auth.organization.id`, delete restrict; submission context, not tenant ownership                |
| `category`                 | Required text: `bug`, `feature_request`, `general`                                                              |
| `data`                     | Required versioned JSONB object; v1 contains trimmed `message` of 1–5,000 characters                            |
| `status`                   | Required text: `new` (default), `in_review`, `planned`, `completed`, `closed`                                   |
| `page_path`                | Nullable application pathname, maximum 500 characters; no query, fragment, whitespace, or protocol-relative URL |
| `created_at`, `updated_at` | Required timestamptz, default now; updates refresh `updated_at`                                                 |

Checks enforce category/status, a JSON object with numeric version >= 1, and safe
pathname shape. Protocol schemas validate supported payload versions and their
content on input and persistence decoding. No message column or attachment storage
exists. Content is immutable after submission; only status changes are exposed.

Indexes: primary key for descending UUIDv7 pagination, `(status, id)`,
`(category, id)`, `user_id`, and `organization_id`. Foreign keys preserve author and
workspace context. No cross-tenant resource link exists; organization membership
is verified at submission and is not a permanent ownership constraint.

Repository operations use the ambient transaction. Test reset removes feedback
before identity tables. See [feedback workflow](../feedback.md) for authorization
and audit transactions.
