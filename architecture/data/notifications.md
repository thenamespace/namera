# Notification and delivery tables

| Table                                   | Purpose and important constraints                                                                                                                                                 |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `notification.notifications`            | Immutable typed occurrence, optional organization/actor, resource, correlation and unique business idempotency key. Actor requires an organization and tenant-matching reference. |
| `notification.notification_recipients`  | Primary key `(notification_id, user_id)`, read/archive times and optional unique email-job reference.                                                                             |
| `notification.notification_preferences` | Sparse email preferences. Separate partial unique indexes cover global and organization-specific user/category/topic/channel scopes.                                              |
| `jobs.email_jobs`                       | Unique business idempotency key, encrypted payload, expiry, availability, attempts, lease token/expiry and provider result.                                                       |
| `jobs.analytics_jobs`                   | Unique dedupe key, typed milestone payload, delivery time, availability, attempts and lease token.                                                                                |
| `core.feedback`                         | User, optional organization, typed category/payload, triage status and optional local pathname. Path constraints exclude query strings and fragments.                             |

Email jobs do not expose recipient addresses as relational columns; the address
and template variables are inside the encrypted payload. Terminal email processing
clears ciphertext. Repository claims and acknowledgments use lease ownership;
delivery policy belongs to the email package.

Analytics jobs are separate from audit history. They are retryable provider
deliveries for committed milestones, not the authoritative record of a mutation.
They use typed, filtered payloads rather than encrypted email content.

Source: [notification schema](../../packages/database/src/schema/notification/),
[job schema](../../packages/database/src/schema/jobs/),
[delivery workflow](../services/notifications.md).
