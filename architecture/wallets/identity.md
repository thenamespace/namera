# Account identities

Namespace is the source of truth for `*.namera.id`. Namera has no identity,
ownership, profile or record table. The account's smart-account address is the
Namespace owner. Namera creates at most one identity per account. Names created
previously or outside Namera remain accessible and are never deleted.

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
Creation locks the existing wallet row while checking Namespace and creating the
name, serializing Namera requests across server instances. A different name for
an already-named account returns `ACCOUNT_IDENTITY_EXISTS`; retrying the same
owned name remains idempotent. No identity row is stored. This cannot prevent
external Namespace writes or guarantee uniqueness if provider reads are stale.

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

The dashboard's `/identity` account selector opens the account's profile directly,
or a create prompt when unnamed, using the loader's Effect atom registry.
Existing multi-name accounts retain a name selector; named deep links remain valid.
`/identity/$accountId/$label` also renders a public profile with
HTTPS artwork and text/address records. Mutations use explicit
forms and permission-aware controls; partial errors refresh provider data. Profile
records never update internal wallet metadata. No owner keys or API secrets enter
the browser. Sidebar navigation uses the existing responsive shell.

Create identity opens `/identity/new`, using the same centered card-form layout
as account creation. The selected account is carried in the validated search
parameter and preselected only if it is active in the current workspace. Direct
visits can select an account in the form. Successful creation replaces the form
route with the account's Identity home; Cancel returns there too. Named accounts
cannot submit another creation from the UI, and direct creation links redirect
to their existing profile.

## Profile image uploads

Workspace owners can select avatar/header files directly from the profile. Both
accept PNG, JPEG, WebP and GIF up to 2 MiB; SVG, empty and oversized files are
rejected. Images are previewed using revocable browser object URLs, without
cropping, compression or upload before confirmation. Keyboard focus and touch
also expose the edit buttons. The shared `TransactionOverview` reviews account,
custody, namespace, network and the public-image changes as a signature-only action.

After confirmation the dashboard requests a scoped nonce from Namespace's
`POST /auth/nonce`, constructs SIWE locally for the current origin and Ethereum,
and uses the owner-only wallet signature prepare/complete endpoints. It checks
the exact request/account, expiry and passkey RP/credential/replay-safe challenge
before approval. Each image has a separate authorization. Browser requests send
the unchanged file, `siweMessage`, `siweSignature` and account address directly to
`POST /profile/mainnet/:name/avatar` or `/header`; only the returned HTTPS URL is
sent to Namera's existing records endpoint. No API secret enters the browser.

The browser adapter follows Namespace Avatar 2.0.2's manual upload protocol using
fetch and existing Viem SIWE helpers. That SDK's published SIWE CommonJS dependency
does not build with Vite/Rolldown, so it is not a dashboard dependency. CSP permits
only `https://metadata.namespace.ninja` for these external connections. Requests
omit cookies/referrers, reject redirects and have a 30-second deadline. Raw SIWE,
signatures and provider errors are never copied into feedback or telemetry.

Images are saved sequentially. A successful upload is retained in memory if its
record write fails; retry saves that URL without re-signing/re-uploading. Completed
fields clear independently. Navigation/authority changes stop subsequent steps;
in-flight uploads are aborted on unmount. There is no rollback of an upload already
accepted by Namespace, including an overwrite of a stable image URL. Drafts and
retry state are not durable across reloads. Existing record auditing is reused;
no new Namera upload endpoint or database table is introduced.

Tests cover consent-stage orchestration, payload/challenge binding, partial
recovery, authority cancellation, byte-preserving multipart requests and response
validation. Live provider upload/verification still needs testing with an owner:
ERC-6492 signatures are produced for undeployed accounts, but acceptance depends
on Namespace's verifier. A rejection keeps the draft and never deploys the account.

## Ethereum primary names

Primary-name transactions now use the generic [owner wallet transaction flow](transactions.md).
The old `POST .../primary/prepare` and `POST .../primary/approve` endpoints
and their request/response schemas have been removed.

`GET /wallets/:walletId/identities/:label/primary` remains an ENS read:
live forward/reverse resolution and the latest operation matching the exact
Ethereum registrar call. It does not attach unrelated wallet transactions to the
identity. Retry metadata is returned only for the initiating user's unsigned
generic operation, including the selected sponsorship mode for reload recovery.

The dashboard requires the forward record to match the account, independently
discovers the Ethereum reverse registrar, encodes `setName(string)`, and sends
that call through wallet transaction preparation. Before approval it independently
checks the account, calldata, factory, nonce, fee envelope, expiry and passkey
challenge against the reviewed intent. Generic backend authorization does not
claim to enforce ENS-specific forward resolution or Namespace ownership.

The UI first requests sponsorship. Only a definitive gas-allowance rejection
triggers a new self-funded preparation with a fresh idempotency key. Other
failures retain the original retry identity. The selected funding is reviewed
before signing; cancellation never signs. Reloaded unsigned attempts reuse the
same key and funding choice.

The review retains its informational Alchemy ETH/USDC quote. It displays estimated
network gas in ETH (up to six decimals) and USD (two decimals), including when
Namera sponsors gas. It uses the pre-BSO simulation rather than zeroed account-paid
fee fields; approval still validates the actual signable envelope separately.

A confirmed receipt is not a verified primary name. The dashboard polls and shows
the Primary badge only when live forward and reverse resolution agree. Offchain
creation alone does not establish reverse resolution. Namespace must resolve
through Ethereum ENS/CCIP-read. Provider-substituted tests do not establish live
mainnet/provider configuration.
