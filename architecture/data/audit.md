# Audit history

Audit records describe committed business changes. They are appended in the same
transaction as the state change, not inferred from HTTP logs or analytics.

| Table                       | Scope and retained context                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| `audit.user_events`         | User and optional session, typed event/data, source, correlation and optional request/trace IDs. |
| `audit.organization_events` | Tenant, optional tenant-matching actor, typed event/data and paired resource type/ID.            |
| `audit.platform_events`     | Optional platform member and typed administrative event data.                                    |
| `audit.beta_invite_events`  | Invite reference and issuance/redemption/revocation event type.                                  |
| `audit.waitlist_events`     | Waitlist reference and distinct previous/current status.                                         |

These tables have creation timestamps but no mutable update timestamps. Ordinary
repositories expose append/history operations, not event editing. This is an
application-level append-only contract, not a claim of database WORM storage.

Organization actor references use composite tenant keys. User session IDs remain
historical context rather than a required live session relation. Payloads follow
versioned protocol unions and must not contain plaintext credentials, signed
request bodies, or arbitrary provider errors. Operational retry bookkeeping is
not itself an audit event.

Source: [schema](../../packages/database/src/schema/audit/),
[audit writer](../../packages/application/src/audit/).
