# Account identities

Namespace is the source of truth for `*.namera.id`. Namera has no identity,
ownership, profile or record table. The account's smart-account address is the
Namespace owner. An account can own multiple names.

## Backend

Authenticated dashboard-only `identity` routes expose network metadata, paged
account names, creation, detail and record updates. Wallet read/update permissions
and user-only actors apply; mutations additionally require the dashboard Origin.
Reads and writes have separate per-user rate limits. All name routes derive the
parent server-side. Both the account's organization and Namespace's current owner
are checked; upstream list filters are not an authorization boundary.

Creation sets Ethereum and default EVM addresses to the smart-account address.
A retry for an already-owned name returns the current provider view. Other owners'
names cannot be claimed. Availability is advisory; the provider arbitrates races.

Text, network address and JSON data records use dedicated provider operations,
not collection replacement. A batch validates before writing and runs sequentially.
`null` removes a record. Unknown records are preserved. A partial upstream failure
returns `PARTIAL_UPDATE` and the applied count; clients must refresh before retrying.
Data records are separate from Namespace search metadata.

Successful changes emit `identity.changed` account audit events without record
values. Namespace changes cannot share a PostgreSQL transaction: an audit failure
after provider success does not roll back the provider. Read Namespace before
retrying after an uncertain response. This is not a durable outbox or an exactly-once
mutation guarantee. No credentials or profile values are emitted in telemetry;
HTTP route templates normalize name and account parameters.

## Verification and remaining boundaries

Server integration tests use the package-owned in-memory Namespace layer and a
migrated test database. They cover provider-source reads, creation retries, record
preservation, validation before writes, failures, origin checks and tenant isolation.
They do not verify live Namespace configuration or DNS-imported `namera.id` ENS
resolution. Production needs the parent configured in Namespace and the existing
`NAMERA_ENS_API_KEY` with access to it.

The dashboard's `/identity` account selector and paginated list share the loader's
Effect atom registry. `/identity/$accountId/$label` renders a public profile with
HTTPS artwork, text/address records and expandable JSON data. Mutations use explicit
forms and permission-aware controls; partial errors refresh provider data. Profile
records never update internal wallet metadata. No owner keys or API secrets enter
the browser. Sidebar navigation uses the existing responsive shell.

## Ethereum primary names

`GET /wallets/:walletId/identities/:label/primary` returns live Ethereum forward
and reverse resolution plus the latest operation. `POST .../primary/prepare`
accepts an actor-scoped idempotency key; `POST .../primary/approve` accepts the
operation ID and, for passkey accounts, an owner assertion. These routes have the
same dashboard-only authorization and Origin policy as record mutations.

Preparation resolves the name to the account, discovers the Ethereum reverse
registrar from `addr.reverse` in the ENS registry, and prepares one zero-value
`setName` call on Ethereum. The account pays ETH gas; sponsorship is not enabled.
No signing occurs during preparation. The browser independently reconstructs
the account and call, checks deployment/nonce/fee/challenge fields, and shows the
maximum ETH network fee before requesting a passkey or explicit 1Claw approval.
See [ENS reverse resolution](https://docs.ens.domains/registry/reverse/).

`core.wallet_operation` stores **transaction recovery state, not identities**:
the scoped actor/account, approved name, pinned owner, prepared and signed
envelopes, idempotency, leases and receipt. Names, ownership, profiles and records
are always read from Namespace. No identity projection or account-name mapping
is persisted. The operation ledger is required to resume the exact signed bytes
after an ambiguous submission without signing a replacement.

Wallet row locks serialize owner operations across this ledger and session-key
approvals on the same chain. Approval rechecks membership, permissions, active
account/key and pinned owner; passkeys bind the origin, RP, credential, challenge
and counter. A signing lease fences concurrent attempts. Accepting the signature,
advancing the counter, reserving execution quota and the approval audit share a
transaction. Ethereum operations emit `wallet.operation_prepared`, `approved`,
`confirmed` and `failed` audit events without record values or signature material.

The wallet-operation worker polls every five seconds, expires only unsigned
approvals, leases pending work, and resubmits the same envelope until a matching
receipt is known. Receipt binding checks chain, hash, sender, nonce and EntryPoint.
Included success and failure settle execution quota; signed operations and their
holds never expire merely because time elapsed. Permanently missing receipts or
unusable signed nonces require operator investigation; automatic replacement is
intentionally not implemented. Worker logs contain operation IDs and bounded
decisions; standard worker metrics use the `wallet_operation` label.

A confirmed receipt is **not** a verified primary name. The dashboard polls and
only shows the primary badge when live forward and reverse resolution agree.
Offchain creation alone never establishes reverse resolution. The Namespace
parent must resolve through Ethereum ENS/CCIP-read before primary preparation can
succeed. Local tests use provider substitutes and real passkey verification;
they do not send live transactions or prove hosted provider/mainnet configuration.

Deployment requires the server (including its startup migration and worker),
dashboard, existing ENS credential and Ethereum RPC/bundler configuration. No
additional identity database service or new environment variable is required.
