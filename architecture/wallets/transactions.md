# Owner wallet transactions

Dashboard-only owner transactions use the existing wallet-operation ledger and
EVM execution adapter. Session-key installation/removal and delegated execution
keep their separate endpoints and lifecycle records.

## HTTP contract

- `POST /wallets/:walletId/transactions/prepare` accepts the existing
  `idempotency-key` header and execution fields `namespace`, `chainId`,
  `calls`, and optional `sponsor`. The call schema is reused directly from
  `ExecuteEvmRequest`; wei amounts use the same bigint/string codec.
- Preparation returns `operationId`, `signingKeyId`, the existing
  `EvmPreparedExecution`, `expiresAt`, and `signing`: either passkey options
  or `method: server` for the supported 1Claw owner. A nullable informational
  Alchemy ETH/USDC price quote preserves the transaction review's USD estimate.
- `POST /wallets/:walletId/transactions/complete` accepts `namespace`,
  `operationId`, and a WebAuthn `response` only for passkey owners. It
  returns the operation ID, namespace, status and UserOperation hash.
- `GET /wallets/:walletId/transactions/:operationId` returns public status,
  nullable UserOperation/transaction hashes, and `submissionBlocked`.
- `POST /wallets/:walletId/transactions/:operationId/cancel` has no body and
  returns the same public status shape. It cancels only the initiating user's
  unsigned preparation, releases its gas hold, and records `wallet.operation_cancelled`
  in one transaction. Repeated cancellation succeeds without another release or audit.

Only authenticated user actors with the existing `wallet:update` permission in
the active organization can invoke these routes. This is the same owner-operation
permission used by primary-name approval; it does not mean every organization
member is an owner. API-key, CLI and MCP actors are rejected, even with wallet
grants. Mutation requests require the dashboard Origin. All routes have per-user
rate limits, are excluded from public OpenAPI, and have no public SDK methods.
Completion and status are scoped to the initiating user, wallet and organization.

## Preparation and approval

The server resolves the public account owner; callers cannot choose a root key.
Preparation never signs. A canonical hash binds wallet, namespace, chain, ordered
calls and effective sponsorship to the actor-scoped idempotency key. Reusing a
key with changed content fails. Wallet locks serialize pending owner operations
with session-key approvals on the same chain.

`sponsor` defaults to true and requires a billing reservation. False prepares
self-funded gas. No backend fallback silently changes the selected funding mode.
For self-funded operations, account balance plus EntryPoint deposit must cover
maximum gas after accounting for outgoing native value. Native transfers require
account balance even when sponsored; an EntryPoint deposit cannot fund transfers.
These are conservative admission checks, not a guarantee balances cannot change
before inclusion. The correct chain client is used for each operation.

Completion rechecks current membership, account/key availability, pinned owner,
expiry, request binding and funding. Passkeys bind the stored challenge, origin,
RP and credential. Managed owners reject client assertions and sign only the stored
envelope. A two-minute signing lease fences concurrent requests. Signature
acceptance, passkey counter advancement, execution reservation and the approval
audit are atomic. Sponsored approvals require their original active gas hold.

The state vocabulary stays `awaiting-signature`, `signed`, `submitted`,
`confirmed`, `failed`, `expired`, `cancelled`. Unlike delegated execution's `prepared`
status, `signed` explicitly means authorized and queued, not onchain success.

Cancellation rejects active signing leases and all signed/submitted operations,
including uncertain submissions. An expired unsigned signing lease can be cancelled;
conditional signature acceptance fences its late result. Cancellation never submits
or replaces a transaction. The dashboard review's Cancel/close action awaits cancellation
before clearing its attempt; reopening starts with a fresh idempotency key. Navigation
and interrupted requests still rely on unsigned expiry as a fallback. A cancelled key
cannot prepare or complete again. PostgreSQL boundary tests cover cancellation versus
completion, duplicate requests, tenant/origin isolation, signing leases and missing receipts.

## Recovery and migration

The existing worker is now owned by `Application.wallet.transactions.reconcile`.
It expires unsigned approvals, broadcasts exact persisted signed bytes and binds
receipts to chain, hash, sender, nonce and EntryPoint. Accepted operations are
polled without rebroadcast; missing receipts/lookups never prove failure.
Ambiguous sends retain holds. Prior uncertain rejection blocks resubmission and
continues read-only recovery. Included success and failure settle execution usage;
actual sponsored cost is settled separately by billing, including absorbed overruns.

Existing `wallet.operation_*` audits stay atomic with lifecycle transitions.
Logs/metrics retain the wallet-operation names; application spans use
`application.wallet.transactions.*`. No calldata, assertions or credentials
are added to telemetry.

Migration `20261013185757_wallet-transactions` admits the new `transaction`
kind. Legacy `set-primary-name` rows remain readable and signed rows continue
reconciling without replacement. Their optional legacy name remains decodable;
new generic records store no name. Unsigned legacy approvals cannot be completed
through the new contract and must expire before a fresh transaction is prepared.
Deploy server migrations and dashboard together.

## Verification

HTTP tests cover arbitrary batches on Base, real WebAuthn verification, managed
signing, idempotency, status reads, origin/tenant/API-key rejection, sponsorship,
self-funding, expiry, concurrent owner-operation exclusion and uncertain receipts.
EVM tests cover chain-specific funding, deposits versus transfer value, and
independent ENS approval validation. Provider submission is substituted; no live
transaction is sent by these tests.
