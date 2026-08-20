# CLI device authorization

The CLI is a pre-registered public client. Device authorization lets a terminal start a request while an authenticated dashboard session chooses organization and session-key grants.

## Starting a device request

The application ensures the configured CLI client exists, then validates:

- exact configured public client ID and active client status;
- API origin as the exact resource;
- a non-empty, deduplicated subset of CLI scopes.

It generates a high-entropy device code and a short code from the configured alphabet/length. PostgreSQL receives only the device-code hash and normalized user-code HMAC. Metadata records device name, CLI version, and platform for the approval UI/audit.

## Device sequence

```mermaid
sequenceDiagram
  participant CLI
  participant Token as OAuth device/token endpoints
  actor User
  participant Dashboard
  participant App as Device application
  participant DB as PostgreSQL transaction
  CLI->>Token: client ID, scopes, resource, device metadata
  Token->>App: Start device authorization
  App->>DB: Insert pending row with hashed codes
  App-->>CLI: Raw device code, formatted user code, URLs, expiry, interval
  par Browser approval
    User->>Dashboard: Open verification URL and sign in
    Dashboard->>App: Claim normalized user code for current user
    App->>DB: Conditionally bind claimed_by_user_id
    User->>Dashboard: Select organization/session keys and approve
    Dashboard->>App: Approval decision
    App->>DB: Insert cli actor, authorization, grants, audit, notification
    App->>DB: Conditionally mark device row approved with authorization ID
    DB-->>App: Commit atomically
  and Bounded polling
    loop Until terminal or expired
      CLI->>Token: Device-code grant request
      Token->>App: Hash and resolve device code
      App->>DB: Enforce client/resource/status/interval
      App-->>CLI: authorization_pending or slow_down
    end
  end
  CLI->>Token: Poll after approval
  App->>DB: Atomically consume approved device row and insert token family
  App-->>CLI: Access and refresh tokens
```

## Claim and approval invariants

- User codes are case-normalized and formatting characters removed before HMAC.
- Claim is conditional; another user cannot take an already claimed request.
- Approval requires the claim to belong to the current user and remain pending/unexpired.
- Selected session keys are deduplicated, organization-owned, and active.
- Actor, authorization, grants, device approval, audit, and notification share one transaction.

## Poll behavior

- Unknown code/client mismatch → `INVALID_GRANT`.
- Resource mismatch → `INVALID_TARGET`.
- Expired request is persisted as expired and returns `EXPIRED_TOKEN`.
- Denied → `ACCESS_DENIED`.
- Already consumed → `INVALID_GRANT`.
- Pending at or above interval → `AUTHORIZATION_PENDING` and records poll time.
- Polling too quickly → `SLOW_DOWN` and increases stored interval by five seconds.
- Approved → conditional single-use consume plus token issuance in one transaction.

The CLI must honor the returned interval and updated slow-down behavior rather than tight-looping.

## Pending before production

- Test simultaneous claim, approve/deny, and final poll races.
- Add operator visibility for abandoned/slow-down-heavy device requests without exposing user codes.
- Define maximum device-name/platform lengths at the protocol boundary if not already constrained.
