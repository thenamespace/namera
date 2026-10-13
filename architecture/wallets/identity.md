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

The dashboard and Ethereum primary-name owner-approval flow are not yet wired.
Offchain creation alone never establishes a primary name or proves reverse resolution.
