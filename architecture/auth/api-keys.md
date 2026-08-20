# API keys

An API key is an organization-scoped machine credential. It owns one `api-key`
actor and one or more active session-key grants. The raw credential is returned
once and never persisted.

## Table: `auth.api_key`

| Field                               | Purpose                              |
| ----------------------------------- | ------------------------------------ |
| `id`, `organization_id`, `actor_id` | Credential identity and principal.   |
| `created_by_actor_id`               | User actor that created the key.     |
| `metadata`                          | Required name/icon/description data. |
| `key_hash`, `key_start`             | Unique digest and visible prefix.    |
| `expires_at`, `last_used_at`        | Lifetime and usage metadata.         |
| `revoked_at`, `revoked_by_actor_id` | Terminal state and attribution.      |
| timestamps                          | Creation/update history.             |

Unique indexes protect the actor and credential digest. Composite foreign keys
prove creator/revoker/credential actor organization ownership. Organization and
last-use indexes support management lists.

## Creation

```mermaid
sequenceDiagram
  actor Admin
  participant API as POST /api-keys
  participant App as Application.apiKey.create
  participant Tx as PostgreSQL transaction

  Admin->>API: metadata + active session-key IDs + duration
  API->>App: enforce api-key:create
  App->>App: generate credential; hash; derive visible prefix
  App->>Tx: create api-key actor and credential
  App->>Tx: create active grants
  App->>Tx: audit + notification recipients + email jobs
  Tx-->>API: safe API key + raw credential once
```

Duration is required and bounded to 1–365 days; the server derives expiration.
Creation has a per-organization rate limit. The returned safe view expands the
creating member and currently granted session-key summaries without exposing
the digest.

## Authentication and authority

The server hashes `x-api-key`, rejects expired/revoked credentials, updates
`last_used_at`, and loads active grants joined to active session keys. Wallet,
session-key, execution, simulation, signing, and verification operations remain
grant-scoped. A key cannot use member permissions or resources outside its
grants.

## Revocation

Revocation conditionally marks the credential and every active grant revoked in
one transaction. The first transition writes one audit event, notification, and
email delivery; repeated calls return the already revoked safe record without
duplicating effects.

## Pending

No work is pending for the current create/read/revoke scope. Per-grant editing is
intentionally unsupported; rotate the API key when its grant set must change.
