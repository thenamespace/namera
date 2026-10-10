# 1Claw managed account integration plan

Status: phases 2, 3, 3A, 4A and 4B provider implementation completed; phase 2A connection/authority contracts
aligned with empty organization bootstrap, with the factory-schema gate still open;
runtime integration not enabled. Updated: 10 October 2026.

Implement 1Claw-managed account owners first. Managed session-key custody is a
later project, but will reuse the uniform provider provisioning flow selected here.
Organization setup never provisions an account or session signer.
The first complete milestone is a managed account that can install
an existing local session key, execute through Namera, and revoke that session.
Creating a provider key and inserting an account row alone is not completion.

This is the accounts-first implementation sequence. The broader
[managed signer research](1claw-managed-signers.md) records resource mapping,
credential handling, provider observations, and future managed-session scope.
That note reports successful raw-digest recovery and one active Ethereum key per
agent; these do not establish the complete account lifecycle. Revalidate provider
constraints against the enterprise deployment before implementing.

## Scope and architecture

Assume Namera operates the integration under its enterprise arrangement with
1Claw. Customer-supplied 1Claw organizations and credentials are out of scope
unless explicitly selected during phase 1.

- Preserve passkey accounts and local session-key behavior.
- Use 1Claw for owner-key provisioning and signing, not transaction broadcasting.
- Keep account construction, signature encoding, and chain compatibility in EVM.
- Keep authorization, policy checks, billing, audits, and workflows in application.
- Keep UserOperation submission and receipt reconciliation in Namera.
- Target a normal factory-deployed ERC-4337 smart account with the 1Claw
  Ethereum wallet as its ECDSA owner. Do not use EIP-7702 for this integration.
- Prefer the existing Alchemy Modular Account V2 family, subject to verifying its
  factory-based ECDSA owner and session-module compatibility. If unsupported,
  stop for an explicit implementation decision; do not silently switch to Safe,
  another implementation, or 7702.
- Do not migrate or rotate existing passkey account owners.

### Package decision

Retire `packages/wallet-keys` and its shared `WalletKeys` service. Use independent
workspace packages under `packages/wallet-providers/`, each exposing its own
Effect service and real provider capabilities. Do not add a shared provider
interface, `core` package, generic provider registry or mandatory lifecycle API.

```text
packages/wallet-providers/
  oneclaw/  -> OneClawService: Platform, customers, claims, agents, keys, signing
  gcp/      -> GcpService: Cloud KMS key lifecycle and signing
  local/    -> LocalService: development file-backed keys and signing

server -> provider configuration and live layers
application -> provider-specific services + database + EVM
EVM -> chain-compatible signing callback, not provider services
```

Application workflows select the provider explicitly, for example
`const oneClaw = yield* OneClawService`. Keep selection in focused provisioning
and signing workflows instead of scattering provider switches across the codebase.
1Claw customer bootstrap and claim renewal stay 1Claw-specific; GCP/local do not
implement dummy equivalents. Add a future `turnkey/` sibling only when integrating
it, with its own service and capability model.

Provider packages own vendor clients, authentication, external-response decoding,
provider-specific errors and test layers. They do not import application, database
or server packages. Application owns Namera permissions, billing, organization
mapping, encrypted persistence, renewal coordination, transactions and audits.
Application may import provider services, but not the vendor SDK/HTTP client.
Server supplies secrets and layers. EVM receives a narrow signer/callback and
owns account construction and chain-specific encoding; this is not a replacement
universal provider interface. Share small helpers only where actual reuse warrants
it, preserving existing crypto/utils boundaries.

The GCP/local split is implemented in phase 4A, including repository dependency
rules and architecture documents. The `oneclaw/` package is implemented in phase 4B;
no 1Claw runtime is enabled yet.

Custody, provider, algorithm, and account implementation are separate concepts:

| Concept                         | Proposed value                         |
| ------------------------------- | -------------------------------------- |
| Custody                         | `namera-managed`                       |
| Provider metadata discriminator | `1claw`                                |
| Owner purpose                   | `wallet-root`                          |
| Owner algorithm                 | `secp256k1`                            |
| Account implementation          | Alchemy Modular Account V2             |
| Account mode                    | Factory-deployed ERC-4337, ECDSA owner |

The 1Claw EOA is the owner/signing identity; the smart account is a separate
contract address derived from its factory and initialization data. Assets and
session permissions belong to the smart account, not the owner EOA. Do not set
the account address to the provider wallet address or fund that EOA as an account
setup step. The contract can remain counterfactual until its first UserOperation.

Namera's existing internal secp256k1 path is 7702-only. This plan therefore
requires a new factory-based account variant, not a change of label on existing
records. Preserve existing 7702 and passkey reconstruction behavior. Provider
API delegation (connection permissions) remains required and is unrelated to
EIP-7702 onchain delegation.

Do not force 1Claw into the current `hsm` protection label. Confirm actual key
generation, storage, signing, export, and TEE/HSM guarantees, then model them
accurately.

## Phase tracker

Complete phases in order. Each phase should be a reviewable change with its own
verification evidence; later phases must not bypass an unresolved earlier gate.

- [ ] Phase 1: provider and account compatibility
- [x] Phase 2: protocol contracts
- [ ] Phase 2A: organization connection and customer-authority contracts
- [x] Phase 3: persistence and recovery model
- [x] Phase 3A: organization connection/customer authority persistence (factory data remains gated)
- [x] Phase 4A: provider package split and WalletKeys retirement
- [x] Phase 4B: provider-specific 1Claw service implementation (package only)
- [ ] Phase 5: EVM managed-owner integration
- [ ] Phase 6: account provisioning workflow
- [ ] Phase 7: managed-owner session authorization
- [ ] Phase 8: API and runtime exposure
- [ ] Phase 9: dashboard and client integration
- [ ] Phase 10: end-to-end verification and controlled rollout

The completed phase 2/3 checkboxes describe the original signer work only. They
do not imply that Platform connections, OIDC issuance, customer-token renewal or
provider calls exist. Implement 2A, 3A, 4A, then 4B; keep the phase 1
production gates open until their evidence is recorded.

## Selected Platform flow

Use one Platform app per deployment environment, not one per customer. Namera
operates the app under its enterprise arrangement. Provision a 1Claw customer
connection lazily when a Namera organization first needs managed custody: an
account now, or a managed session key in its later project. Ordinary Namera signup
and sign-in do not create provider resources. Set up the connection once with a
versioned empty template, `spec: {}`. Create every signer afterward through the
same delegated-agent flow, including the first signer.

```text
Namera organization
  -> stable OIDC identity + organization email
  -> one 1Claw customer / isolated sub-organization / connection
       -> one-time empty bootstrap, customer authority and delegation
       -> account A: dedicated agent + Ethereum owner key
       -> account B: dedicated agent + Ethereum owner key
       -> future managed session: separate agent + key (out of current scope)
```

### Organization identity

- Stable subject: `namera:org:<organization-id>`.
- Stable email: `org-<organization-id>@namera.ai`, with environment isolation for
  non-production identities. This is the selected convention, not a claim that
  provider support for synthetic organization identities has been approved.
- Never use the current member's email, organization display name or mutable slug
  as identity. Membership changes must not change provider ownership.
- Never reuse an organization email or subject after organization deletion.
- Route production addresses to a controlled mailbox/alias for security and
  recovery messages. Define who can access it; avoid unattended catch-all recovery
  authority. Do not claim `email_verified` unless the trust arrangement supports it.
- Issue short-lived RS256 tokens server-side with configured `iss`, `aud`, `sub`,
  `email`, `iat`, `exp` and unique `jti`. Select keys through `kid`. Bind the subject
  to the authorized organization, never to arbitrary caller-supplied claims.
- Publish only public keys at a stable HTTPS JWKS endpoint. No temporary tunnel
  in production; private issuer keys stay in server secret storage. Support key
  overlap during rotation. Existing Namera browser authentication is unchanged;
  this does not require making Namera a general-purpose interactive OIDC provider.

### Authentication boundaries

| Credential                                | Responsibility                                                                | Storage / lifetime                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------- |
| Platform app API key                      | Upsert, bootstrap, connection lookup, claim reissue, delegated agent creation | Deployment secret; not copied per account               |
| Organization OIDC JWT                     | Establish organization identity during upsert                                 | Short-lived, generated on demand; not persisted         |
| Customer auth token from claim redemption | Grant delegation, provision signing keys, enable raw signing                  | Organization-bound encrypted credential, expiry tracked |
| Dedicated agent API key                   | Authenticate account owner signing                                            | Encrypted per-agent credential                          |
| Agent access token                        | Authenticated signing requests                                                | Short-lived provider cache; not persisted               |

SDK Platform authentication uses `{ token: platformApiKey }`, not the user-key
`apiKey` exchange. Agent authentication uses `{ agentId, apiKey: agentApiKey }`.
Human API credentials used to register the Platform app in experiments are not
normal application runtime credentials. Application/EVM do not import the SDK.

### One-time organization setup

1. Authorize the Namera actor and precheck the requested resource entitlement.
2. Resolve the organization connection locally. If missing, first attempt provider
   recovery by exact OIDC subject within the configured app. If genuinely absent,
   issue the OIDC JWT and upsert with `create_sub_org: true`. Persist the returned
   customer and connection mapping before further remote work.
3. Bootstrap the unbootstrapped connection using the configured, versioned
   organization-setup template with exactly `spec: {}`. No agents, signing keys,
   vaults or policies are requested. Validate that no resources were returned;
   a non-empty result is configuration drift, not the first account's signer.
4. Redeem the bootstrap claim, validate the customer token by authenticated
   identity lookup, and compare the customer ID with the connection's user ID.
   Encrypt and persist the bound customer credential and expiration.
5. Grant only the needed delegation scopes (`agents:read`, `agents:write` were
   tested), then verify the grant. Record local readiness only after successful
   checks. These scopes do not authorize delegated wallet provisioning.

Serialize setup per connection using the existing setup lease. Ready means empty
bootstrap, verified customer authority and required delegation are established;
it does not mean an agent, wallet or smart account exists. Setup can succeed even
if the triggering account creation later fails.

Template bootstrap is one-time per connection. A 409 must trigger reconciliation,
not another customer, template, or bootstrap attempt. For a confirmed completed
bootstrap, recover authority through bounded claim reissue/redemption. Do not
re-bootstrap old test connections with non-empty templates or automatically adopt
their agents as new account/session resources.

### Uniform signer provisioning: every account and future managed session key

1. Ensure the organization's connection is ready and obtain valid, identity-bound
   customer authority, renewing it when needed. A ready connection skips setup.
2. Allocate local signer/credential IDs and create a dedicated agent through
   `withConnection(connectionId).agents.create()` using the Platform key and
   connection delegation. Enable `intents_api_enabled` for the signing flow.
3. Immediately encrypt and persist the one-time agent API key with its
   organization/connection/agent bindings and audit. Recovering a connection ID
   cannot recover a lost one-time agent credential.
4. Create exactly one Ethereum signing key using the **customer token**, then
   enable `raw_signing_enabled` with customer authority. Read back and validate
   flags, agent/key identity, chain, curve, public key, address and pinned version.
5. For an account owner, derive the factory-based smart account with this EOA as
   owner, then perform the locked billing check and transactional persistence.
   A future managed session uses the same provider steps, but keeps its separate
   policy, approval, installation and lifecycle workflow. Creating a signer never
   makes a session active or grants access to an account.

There is no bootstrap-first-owner branch. First and subsequent resources all use
steps 1–4. Never rotate or reuse another account/session's agent/key for a new
resource, and never route routine session signing through its account owner.

The tested delegated Platform call to create a signing key returned 403 requiring
a human user token; the customer token from claim redemption succeeded. Treat
these as distinct capabilities, not interchangeable authentication options.
Both agents created after empty bootstrap appeared in delegated listing, but the
connection's `agent_ids` stayed empty. Namera's tenant-scoped signer mapping is
authoritative for its accounts and sessions; that array is not a complete inventory. Confirm
provider resource attachment semantics before relying on provider listings for
revocation, billing, deletion or recovery.

### Customer authority renewal

Track customer token expiration and renew before a management operation when
expired or within a small skew window. Use the Platform key to call
`reissueClaim(connectionId)`, redeem the new claim, verify the same customer
identity, and atomically replace the encrypted token and expiration. Serialize
renewal per connection so concurrent requests do not race one-time claims.
Do not log or persist claim URLs/tokens; lost redemption responses require a
bounded reconciliation/reissue path, not an unbounded retry loop.

Repeated redemption on an already-claimed email-based customer returned a fresh
86,400-second token with extended expiry. No old customer token was required for
renewal, and no refresh token was returned. Exact post-expiry behavior and renewal
on an OIDC-created customer are still untested. Confirm that server-side claim
redemption is an approved production credential lifecycle, including revocation,
disconnect and reissue limits. Do not bypass a revoked connection by re-claiming it.

Routine signing uses agent credentials, not customer authority; a customer-token
refresh is not required before every signature. Namera authorization and policy
checks remain mandatory before owner operations.

### Lost connection recovery

Call `platform.listUsers(appId)` and match `external_subject` to the stable org
subject. Accept exactly one match, validate the returned connection, and persist
it with tenant uniqueness checks. Never match on display names or use another
organization's connection. Zero matches after an ambiguous create can be eventual
visibility, so stop for reconciliation rather than immediately creating again.
Multiple matches require operator review.

Live tests recovered the exact original OIDC connection this way. Active Platform
key listing and OIDC subject recovery were tested separately; the latter used
the owner key because its temporary app had been deactivated. The current list
contract exposes no filtering/pagination arguments; test large-app completeness
before assuming a missing row proves absence. Repeated OIDC upsert returned
`409 / link_required`; do not treat this as permission to link accounts silently.

### Live evidence and limits

Experiments used disposable resources, verified raw signatures locally and sent
no transactions. Scripts 18–28 and sanitized findings live in the temporary
`namera-1claw-test` project; private response files contain credentials and must
not be copied into this repository. Tested against SDK 0.61.38 and the live API.

| Test                                                     | Result                                           |
| -------------------------------------------------------- | ------------------------------------------------ |
| Wrong OIDC audience                                      | 400 rejected                                     |
| Valid OIDC without email                                 | 400, email claim required                        |
| OIDC with email and isolated customer request            | 201                                              |
| Repeat identical OIDC token                              | 409 / link_required                              |
| OIDC JWT directly as customer API token                  | 401                                              |
| Bootstrap and initial raw signature                      | Success, signature verified                      |
| Claim redemption and customer identity                   | 200, identity matched                            |
| Customer grants delegation                               | 204                                              |
| Delegated list / second agent creation                   | 200 / 201                                        |
| Delegated signing-key creation                           | 403                                              |
| Customer-token signing-key creation / raw-signing update | 201 / 200                                        |
| Both agents sign after second key creation               | Both signatures verified                         |
| Claim reissue / repeated redemption                      | 200 / 200; extended customer token expiry        |
| Existing connection recovery by subject                  | Exact original connection recovered              |
| Empty template creation / bootstrap (`spec: {}`)         | 201 / 201; no initial agents, vaults or keys     |
| Empty-bootstrap claim / identity / delegation            | 200 / 200 / 204; customer identity matched       |
| Two delegated agents after empty bootstrap               | 201 each; distinct agents and Ethereum addresses |
| Customer key creation / raw enablement on both           | 201 / 200 each; flags and key metadata read back |
| Both sign; first signs again after creating second       | All three signatures cryptographically verified  |
| Delegated list versus connection `agent_ids`             | Both agents listed; connection array empty       |

The empty-bootstrap experiment (`src/28-empty-bootstrap.ts`, 10 October 2026)
used a fresh silent-email customer on the existing test app, not a fresh OIDC
customer. Earlier OIDC evidence remains separate. Re-test the combined OIDC →
empty bootstrap → claim → uniform signer flow before rollout. Only test digests
were signed; no smart account was deployed or session installed.

This proves useful provider primitives, not the factory-based smart-account lifecycle,
sub-organization isolation, production recovery guarantees or custody claims.

### Phase 1: provider and account compatibility

Use an explicitly authorized disposable provider agent/key. Do not use production
funds. Extend the previously reported digest experiment with reproducible vectors.

- Use the selected Platform/OIDC model above; confirm enterprise approval for
  organization email identities and server-side claim redemption/renewal.
- Verify sub-organization isolation and cross-connection denial, not just a
  successful `create_sub_org` response. Verify actual post-expiry renewal on an
  OIDC-created customer and revoked/disconnected-customer behavior.
- Confirm one dedicated agent/key per account owner, creation limits, signing
  quotas, billing, incremental provisioning, and credential rotation.
- Verify public-key encoding, derived address, exact digest signing without extra
  hashing, signature encoding, parity, and low-S normalization.
- Verify the chosen factory/initialization API, ECDSA owner validator, EntryPoint
  version, deployment addresses and compatibility with existing session modules.
- Verify the exact owner UserOperation signing convention required by that
  validator, including any EIP-191 wrapping or typed-data hashing. Raw digest
  support alone does not prove validator compatibility; apply required hashing
  in EVM exactly once. No EIP-7702 authorization signature is needed.
- Confirm stable key/version selection and behavior after provider key rotation.
- Establish provisioning/signing retry semantics, lookup after ambiguous timeout,
  approval-required responses, and deactivation versus destruction.
- Confirm custody/export guarantees and required raw-signing configuration.

**Exit gate:** record supported primitives, verified test vectors, enterprise
constraints, account-mode choice, credential strategy, and unresolved blockers in
the research note. Do not proceed on assumed P-256 support or an unverified
protection label. A failed factory-based ECDSA/session compatibility gate requires
an explicit implementation decision, not a fallback to 7702.

### Phase 2: protocol contracts

Owners: `packages/protocol`, with review of current provider and wallet contracts.

- Add versioned 1Claw signing-key/provider metadata and lifecycle input variants.
- Pin provider agent, key identity/version, chain family, and top-level `credentialId`.
- Resolve the existing secp256k1/HSM restriction honestly for this provider.
- Define managed account inputs and safe public ownership responses while
  preserving passkey compatibility. Account mode remains server-selected.
- Define typed provisioning, provider-unavailable, approval-required, identity
  mismatch, and unsupported-capability failures where appropriate.
- Keep provider credentials and internal locators out of public DTOs.

**Exit gate:** schema tests cover valid variants, invalid combinations, existing
passkey payloads, and public response redaction. No new HTTP capability is enabled.

Implemented contracts:

- `SigningKey`/`SigningKeyInsert` accept versioned `1claw` metadata. Ethereum,
  Bitcoin and Tron require secp256k1; Solana, XRP and Cardano require Ed25519.
  These are metadata shapes, not enabled account namespaces or signing support.
  Midnight is excluded until its curve and signing contract are established.
- 1Claw signers require a top-level `credentialId`. Existing variants accept an
  absent or null reference for compatibility with the pre-migration database.
  Passkey `data.credentialId` remains the unrelated WebAuthn identifier.
- `Credential`/`CredentialInsert` describe the planned generic `core.credentials`
  table. Its first typed variant is `1claw-agent`, with non-secret versioned
  agent metadata and an encrypted payload. The decrypted envelope binds version,
  credential ID, organization ID and agent ID to a redacted API key.
- Provider creation accepts explicit `provider: "1claw"`, Ethereum/secp256k1,
  organization ID and a preallocated credential ID. Its result carries pinned
  public key metadata and the redacted credential envelope for application-owned
  encryption. No private signing key is returned. Signing and disable inputs
  carry tenant-scoped credential references. Phase 4 must resolve and validate
  those references before provider authentication.
- Only Ethereum 32-byte digest signing and disablement have new input variants.
  No 1Claw message-signing or destruction capability is claimed. Legacy GCP/local
  creation and protection levels are unchanged; their standalone `WalletKey`
  compatibility model is not extended into a second 1Claw identity model.
- Public owner input is `{type: "namera-managed", provider: "1claw"}`. Its safe
  response exposes only signing-key ID, custody, provider and algorithm. It has
  no HSM/software claim, credential reference, agent ID or provider key locator.
- `WalletKeyError.code` adds optional provider-unavailable, approval-required,
  identity-mismatch, unsupported-operation and incomplete-provisioning categories.
  Optionality preserves existing provider errors. Actual provider mapping is
  phase 4 work, not implemented by defining the categories.
- `cryptoPurpose.providerCredential` reserves `core.credentials.payload` for
  encryption with existing `CRYPTO_ENCRYPTION_KEY`. No new secret or encryption
  implementation is introduced. Key rotation remains a separate operational task.

The HTTP managed-custody gate remains unchanged. Internal 1Claw creation and
account loading also fail closed; local/GCP providers do not provision substitute
keys for 1Claw requests. Persistence, provider authentication, binding checks,
billing classification and managed account operations remain later phases.

Verification: protocol suite (40 tests), wallet-key provider suite (6 tests),
wallet/passkey/OpenAPI boundary suites (12 tests), wallet response mapping
(3 tests), and `pnpm check` passed. No live 1Claw resources were created or used.

### Phase 2A: organization connection and customer-authority contracts

Owner: `packages/protocol`. This is new work, not part of completed phase 2.

- Define an internal provider-connection model: organization, provider, app ID,
  stable subject/email, customer ID, connection ID, readiness and timestamps.
  Readiness records observed setup state, not an arbitrary provider status string.
- Extend generic credentials with a distinct `1claw-customer` variant. Its
  encrypted envelope binds credential/organization/app/connection/customer IDs,
  token and expiration. Do not overload `1claw-agent` or a signer's credential FK.
- Align provisioning contracts with separate empty organization setup and one
  uniform agent-creation request/result. Empty bootstrap returns claim/setup
  information, not a signer or agent credential. Agent creation returns the
  one-time credential for immediate encryption. Expose connection management through a focused
  capability exposed by `OneClawService`, not a universal provider contract or
  an SDK imported into application. Keep vendor request/response schemas inside
  the provider package; protocol owns shared domain/persistence/public contracts.
- Define bounded errors for linking required, ambiguous recovery, revoked
  connection, expired authority, identity mismatch and incomplete provisioning.
- Add a factory-based secp256k1 wallet-data discriminator alongside the existing
  7702 variant. Define reconstruction data required by the selected factory:
  owner identity, salt, implementation/factory version, validator initialization
  and EntryPoint version as applicable. Pin factory resolution through persisted
  versioned metadata or explicit addresses; exact fields follow phase 1 evidence.
  Do not reinterpret existing `accountMode: "7702"` records or require delegation
  versions for new factory accounts. Public creation remains server-selected.
- Decode the actual claim response's `auth_token` and expiry explicitly; the
  installed SDK's claim-response type omitted those fields despite live responses.
  Check HTTP status and required fields as well as SDK `error`; the tested 409
  upsert response had a null SDK error.

**Exit gate:** schema/redaction tests cover both credential types, identity
bindings, missing response fields and preservation of existing signer contracts.

Implemented protocol slice: branded local connection IDs, versioned connection
identity/readiness models, discriminated customer credentials with required expiry,
redacted decrypted envelopes, connection/credential/payload binding validation,
the earlier bootstrap-versus-incremental request contracts, early one-time agent credential
results and bounded connection error codes. Existing agent credential shapes and
public owner projections remain compatible. Database types/repositories remain
explicitly agent-only until phase 3A; no table, migration or live call was added.

**Contract follow-up completed with phase 4B:** `OneClawOrganizationSetupRequest`
models reconciled pending setup independently. `OneClawOwnerProvisioningRequest`
now requires a ready connection for every agent and rejects the old mode/template
fields. Tenant-bound early credential results and public API projections remain
unchanged. No additional table is required: reuse phase 3A provider
connections, customer/agent credentials and signer linkage. Verify readiness
transitions do not require a bootstrap-created signer.

Phase 2A remains partially complete: factory reconstruction metadata is gated on
phase 1 factory evidence, and vendor claim-response/status decoding will live in
the phase 4B provider package rather than protocol. No arbitrary factory fields or
shared provider service were introduced. Expiry-clock checks, token verification,
revocation and transactional ownership checks remain runtime responsibilities.

Verification: 66 protocol tests (including 26 new connection/provisioning cases),
7 existing credential persistence tests, and `pnpm check` (74 tasks) passed.
No external resources were used. Phase 3A is still required before storing customer
credentials or connection rows.

### Phase 3: persistence and recovery model

Owners: `packages/database`, protocol persistence models.

- Extend `core.signing_key` discriminator/custody checks for 1Claw metadata.
- Retain `core.wallet.signing_key_id` and existing tenant-safe relationships.
- Add the selected provider-tenant mapping in phase 3A; it was not implemented
  in the original phase 3.
- Add generic `core.credentials`, initially typed as `1claw-agent`, with encrypted
  payloads using existing crypto infrastructure. Credentials cannot be hashed
  because provider authentication needs their original value.
- Add nullable `core.signing_key.credential_id`, required for 1Claw rows and null
  for other variants, with an organization-scoped foreign key. Do not duplicate
  this reference in JSON metadata or introduce a `signing_key_credential` table.
- Do not add `wallet_provisioning` or another provisioning-attempt table in this
  iteration. Partial or ambiguous remote creation requires manual recovery;
  automatic crash recovery and exactly-once remote creation are not promised.
- Handle the crash window after a one-time credential is issued but before it is
  stored: define provider-assisted rotation/recovery or safe cleanup.
- Keep private keys, OIDC JWTs and agent access JWTs out of the database. The
  organization customer token is an explicit encrypted, expiring exception in
  phase 3A. Do not duplicate signer identity in a competing provider-wallet table.

**Exit gate:** migrations and repository tests prove tenant isolation, uniqueness,
credential scoping and atomic local writes. Document manual recovery for remote
resources left behind by failures, including lost one-time credentials.

Implemented: `core.credentials`, the tenant-scoped signing-key credential FK,
provider identity uniqueness, metadata/custody/algorithm checks, transaction-aware
credential insert/read methods and relations. Migration
`20261009185014_melted_nomad` is tested through the disposable database layer.
Persistence tests cover isolation, restricted deletion, malformed metadata,
uniqueness, transaction commit/rollback and existing signer variants. Encryption
and cross-row credential/agent binding remain application/provider work; no live
provider workflow or new audit-producing mutation is enabled by this phase.

Manual recovery policy for the later provisioning workflow:

- Stop after an ambiguous remote creation result; do not blindly repeat creation.
- An operator must reconcile the agent and key using available non-secret provider
  identifiers before retrying local persistence or provisioning anything new.
- If a one-time API key was lost, use only provider-confirmed rotation/recovery.
  Until that mechanism is verified, leave the resource unresolved for operator
  review rather than assuming its credential can be retrieved.
- Do not automatically delete agents or keys. Confirm ownership, usage and funds
  before any separately authorized cleanup. Never record API keys or temporary
  JWTs in logs or recovery notes.

### Phase 3A: organization connections and encrypted customer authority

Owners: database and protocol; application encryption/runtime wiring follows in the provider workflow phases.

**Implemented:** tenant-scoped connection reservations, remote identity reconciliation,
bootstrap/delegation readiness, encrypted customer credential expiry and ciphertext
replacement, nullable signer connection links, migrations and transaction-aware
repositories. Setup/renewal uses a token-owned 60-second database lease; credential
replacement also compares the previous ciphertext. PostgreSQL tests exercise
eight-way contention; PGlite covers constraints, tenant isolation, stale leases,
binding checks, rollback and legacy signer compatibility. No live API is enabled.

Reservations temporarily allow null remote/customer IDs to coordinate first setup
before HTTP. Lease expiry is not permission to repeat an ambiguous remote mutation;
reconcile first. Old unlinked 1Claw signers require operator reconciliation. Database
attachment validates cleartext identity metadata; the later application workflow
must encrypt/decrypt using `cryptoPurpose.providerCredential`, validate the envelope,
and emit transactional audits. Early agent-credential persistence is available, but
the provider workflow that receives and encrypts it is not wired yet.

**Deferred gate:** factory-based ECDSA reconstruction checks remain blocked on the
phase 1 compatibility evidence, just as in phase 2A. This persistence change does
not invent a factory schema or alter passkey/7702 data. Implement those checks with
the verified factory adapter, before enabling account creation.

- Add `core.provider_connections` with a local
  ID, organization ID, provider, app ID, subject, email, provider customer ID,
  connection ID, customer credential reference, readiness and timestamps.
- Enforce one mapping per organization/provider/app, unique provider/app/subject
  and provider/app/connection IDs, plus organization-scoped credential FKs.
  Application verifies that the referenced credential is the customer variant
  and its decrypted identity bindings match the row.
- Extend `core.credentials` type/data constraints for `1claw-customer`; retain
  encrypted payloads using `cryptoPurpose.providerCredential` and
  `CRYPTO_ENCRYPTION_KEY`. Store a validated non-secret expiry alongside the
  encrypted envelope for renewal scheduling; compare both when decrypting.
- Extend wallet JSON checks and persistence decoding for factory-based ECDSA
  reconstruction data. Test round trips and migration compatibility for existing
  passkey and 7702 rows. Do not migrate their owners, modes or addresses.
- Add transaction-aware lookup by organization/app, insert/reconcile mapping,
  readiness transition, and compare-and-swap customer credential replacement.
  Add a cross-instance serialization strategy for initial setup and renewal.
  Do not hold a long database transaction open across provider HTTP calls.
- Encrypt and persist returned one-time agent credentials promptly, before
  wallet provisioning/final account persistence. Unattached credential records
  may remain after failure and require operator reconciliation. This intentionally
  revises the original all-at-final-transaction credential plan.
- Keep `wallet_provisioning` out of scope. A connection mapping is durable tenant
  identity, not a per-wallet attempt ledger. Uniqueness alone does not make remote
  creation exactly-once; crashes during external creation still require recovery.

**Persistence exit gate met:** migrations/repositories prove tenant isolation,
unique mappings, credential type/metadata binding checks, renewal contention,
idempotent local reconciliation and transaction rollback. Audit emission and
authenticated encrypted-envelope checks remain in the later application workflow.
No runtime API enabled; factory reconstruction remains gated as noted above.

### Phase 4A: provider package split and WalletKeys retirement (completed)

Owners: existing wallet-keys consumers, provider packages, application, EVM and
server composition. Perform this as a behavior-preserving migration before
enabling the new 1Claw runtime flow.

- Inventory WalletKeys imports, creation/signing inputs, local/GCP implementations,
  test substitutes, configuration, package exports and disabled-layer consumers.
- Move GCP and local implementations into independent `gcp/` and `local/` packages,
  each with provider-specific service/configuration/errors and package-owned
  tests. Preserve key locators, local file format/path, GCP CRC checks, algorithms,
  digest semantics and existing protection caveats. Do not regenerate keys.
- Add the nested `packages/wallet-providers/*` workspace glob. Give each package
  its own manifest, exports, build/typecheck/test configuration and README,
  following existing `namera-source` and unbundled build conventions. Update
  package dependencies, lockfile and any tooling that assumes flat packages.
- Replace application `yield* WalletKeys` with the appropriate explicit service
  in focused provider-specific workflows. Translate vendor errors at the
  application boundary into domain errors; do not force a shared provider error
  taxonomy or retain a renamed generic dispatch service.
- Change EVM constructors that depend on WalletKeys to accept the required
  chain-compatible signer/callback. Application supplies that signer using its
  chosen service. EVM must not import OneClawService, GcpService or LocalService.
- Move provider-only operation schemas out of shared protocol where appropriate;
  retain shared signer/credential models and preserve public contracts. Phase 2
  contracts were written for the old boundary and require this explicit review.
- Replace generic test layers with provider-owned substitutes and narrow EVM
  signer fixtures. Preserve fail-closed managed-custody gating in application and
  server without depending on `WalletKeys.disabledLayer` or fallback providers.
- Remove the old package/service only after all consumers and tooling migrate.
  Update AGENTS dependency rules, package map, READMEs and owning architecture
  documents in the same implementation change. No permanent compatibility facade.

Implemented: independent `@namera-ai/wallet-provider-gcp` and
`@namera-ai/wallet-provider-local` packages with explicit services, local operation
schemas, errors, live/test/disabled layers and provider tests. Application creation
uses GCP explicitly; persisted signing locators choose GCP or local callbacks.
EVM already accepted callbacks and required no API change. Server composition
remains fail-closed. The old package is removed, with no replacement facade.
Legacy published protocol operation schemas/errors remain deprecated compatibility
exports, unused by the new services. Shared signer/credential contracts are intact.
No keys, database rows, public routes or managed-custody gates were changed.

**Exit gate:** no runtime WalletKeys imports or shared provider lifecycle remain;
GCP/local lifecycle tests, EVM signer tests and application boundary tests pass.
Run `pnpm check` for this cross-package migration. Existing passkey/local-session
flows, stored keys and public managed-custody gates retain their behavior.

### Phase 4B: provider-specific 1Claw service implementation (completed, package only)

Owner: `packages/wallet-providers/oneclaw`, with application orchestration.

- Implement OIDC JWT issuance/JWKS material handling, upsert and subject lookup,
  empty organization bootstrap, claim redemption/reissue, authenticated customer
  identity checks, delegation management, uniform scoped agent creation, customer-authenticated key
  creation/raw enablement, and agent-authenticated signing.
- Complete the phase 2A contract follow-up first. Keep empty-bootstrap results
  distinct from agent-creation credentials; do not retain a first-owner branch.
  Reject non-empty organization-setup templates or unexpected resources.
- Separate Platform, customer and agent authentication in the provider. Handle
  token expiry with bounded renewal, never a fallback to a deployment human key.
  Application owns encrypted persistence and org authorization; provider code
  receives decoded, bound credentials without importing database/application.
- Validate external public material and derive/compare the returned signer address.
- Implement exact digest signing and only other operations genuinely supported.
- Decode the provider signature format and return validated signing material;
  adapt it to the EVM signing callback without imposing GCP's response format on
  1Claw. Keep Ethereum-specific encoding/parity in EVM. Avoid double hashing.
- Implement bounded timeouts/retries and typed failures. Do not retry ambiguous
  non-idempotent provisioning blindly.
- Fail explicitly for unsupported destruction; never claim deactivation destroyed
  key material. Handle approval-required responses as a distinct outcome.
- Supply a package-owned deterministic test layer and sanitized provider fixtures.

**Exit gate:** provider tests cover wrong-key responses, rotation, invalid encoding,
auth expiry, rate limits, outages, empty-bootstrap responses without agent fields,
claim response validation, delegation denial, and two successive agents through
the same creation path. No live credentials appear
in logs, traces, errors, or fixtures.

Implemented `@namera-ai/wallet-provider-oneclaw` with SDK `0.61.38`, the operation
groups above, separate RS256 org OIDC/JWKS service, protocol `OneClawError`, and
central sanitized envelope/exception conversion. Configuration and both server
env examples use a dashboard-created Platform app and pinned empty template;
there is no runtime app/template creation or human-key fallback.

Customer operations validate decoded authority bindings, clock expiry and remote
identity. Agent creation returns the one-time redacted key before any follow-up
call. Signing explicitly obtains a fresh agent token, checks pinned key metadata
and public material, and verifies the exact digest signature. Destruction is
unsupported. Package-owned test layers and real-SDK/substituted-transport tests
cover these boundaries without live resources or transactions.

SDK limitation: no AbortSignal/custom fetch support. Timeouts bound waiting but
do not cancel remote work; there are no automatic retries. Ambiguous writes need
reconciliation/manual recovery. Template validation precedes bootstrap but cannot
atomically pin its version; freeze the dashboard template. Scope verification
probes delegated reads; the subsequent create proves write permission.

Remaining integration work: public discovery/JWKS hosting and rotation, server
layer composition, encrypted credential persistence/renewal orchestration,
factory account verification, application authorization/billing/audits, and
production OIDC empty-bootstrap checks. This phase adds no tables, public routes,
audit mutations, broadcast capability, or public managed-custody enablement.

Verification: 16 provider integration tests and 67 protocol tests passed, as did
`pnpm check` (82 lint/typecheck/test-typecheck/build tasks). Provider tests use
the real SDK with substituted transport; they are not a live enterprise rollout.

### Phase 5: EVM managed-owner integration

Owner: `packages/evm`.

- Reuse compatible secp256k1 signing primitives, but add a factory-based smart
  account constructor/reconstructor rather than calling the 7702 constructor.
- Accept the application-supplied owner signer without importing any provider
  service or resurrecting the retired WalletKeys dependency.
- Derive the owner EOA from its public key, encode the verified owner-validator
  initialization and salt, and compute the counterfactual smart-account address.
  Compare reconstructed address with persisted address on every account load.
- Include factory/init data only when deployment is needed. Verify the first
  successful UserOperation deploys the expected contract, then subsequent
  operations use that same account. Do not generate 7702 authorizations.
- Verify owner-operation signing and signature recovery against the stored key.
- Verify ERC-1271 and counterfactual ERC-6492 behavior where supported, plus the
  existing session installation/removal validators on the new account mode.
- Define supported networks and reject unsupported ones before signing.
- Keep account registration distinct from per-network onchain readiness.

**Exit gate:** unit and fork/integration tests prove factory derivation, first-op
deployment, owner validation, reconstruction, and rejection of substituted
factory/initialization/owner/account/network data. Existing P-256 and internal
7702 behavior remains unchanged.

### Phase 6: account provisioning workflow

Owner: `packages/application`.

The 1Claw workflow obtains `OneClawService` directly. It coordinates the provider
operations below with encryption, repositories and EVM; the provider package does
not own Namera's organization records or database transactions.

1. Authorize the actor and precheck managed-account entitlement/capacity.
2. Ensure organization setup once: resolve/recover or create its connection,
   persist the mapping, empty-bootstrap only when needed, verify/store customer
   authority, grant required delegation and record readiness. Serialize setup
   across concurrent requests, without holding a transaction across provider calls.
3. Ensure valid customer authority, then allocate local signer/credential IDs.
   Every account, including the first, creates a dedicated agent through delegated
   Platform access. Immediately encrypt/persist its credential with an audit so
   later failures do not discard the only copy.
4. Using customer authority, create one Ethereum signing key and enable raw signing.
   Read back and validate agent/key identity, public material and signing state.
   Empty bootstrap never supplies a key; there is no first-account exception.
5. Construct the factory-based EVM smart account with the provider EOA as owner;
   persist the smart-account address separately from the signer identity.
6. Lock billing state, repeat capacity checks, and atomically persist the signer,
   wallet, binding to the previously protected credential, required audits and
   notifications. Recheck credential/connection organization and readiness.
7. Report partial or ambiguous failures for manual recovery. Never blindly retry
   remote creation or claim that a remote resource was rolled back.

Keep organization setup and provider signer creation as separate focused
application workflows so future managed sessions can reuse the provider flow
without invoking account construction. Managed-session policies, installation and
API/runtime exposure remain outside this accounts-first milestone. A failed signer
creation does not undo a successfully prepared organization connection.

Keep remote calls outside long database transactions. Use provider idempotency
only if verified; a local transaction does not make remote creation atomic.
Never destroy a provider key automatically if it might control a funded account.

**Exit gate:** workflow tests prove one empty setup under concurrent first-resource
requests, identical agent/key provisioning for first and subsequent accounts, and
reuse of a ready zero-agent connection after failed creation. Cover concurrent
capacity checks, provider success
followed by database failure, lost responses and safe orphan handling. Successful
local account, signer, credential binding and audit writes are atomic; ambiguous remote
outcomes require the documented manual procedure.

### Phase 7: managed-owner session authorization

Owners: application session-key workflows and EVM owner operations.

This phase enables existing **local session keys on managed accounts**, not
managed session-key custody.

- Generalize session registration/account reconstruction beyond passkey-only
  owners without weakening existing local-owner verification.
- Add a permission-checked managed-owner approval path for installation/removal.
- Sign only the exact stored, reviewed operation, never caller-supplied arbitrary
  owner calldata or a freely exposed root-signing endpoint.
- Preserve idempotency, policy/billing reservations, submission recovery, and
  receipt-confirmed installation and revocation.
- Recheck authorization/lifecycle before accepting provider signatures. Define
  durable recovery if approval/signing is delayed or its response is ambiguous.
- Preserve immediate API cutoff on revocation and subsequent onchain removal.
- Update execution/signature account loading where it assumes a passkey owner.
  Never fall back from a failed session signer to root signing.

**Exit gate:** a managed owner can install and uninstall a local session, while
unauthorized actors, stale authority, mismatched operations, and cross-tenant
requests are rejected. Pending sessions do not become active on HTTP success alone.

### Phase 8: API and runtime exposure

Owners: `packages/api`, `apps/server`, configuration and feature gating.

- Expose managed account creation behind explicit deployment/organization gating.
- Replace the blanket managed-custody rejection only for supported configurations.
- Compose the provider without enabling unavailable custody modes accidentally.
- Compose explicit OneClawService/GcpService/LocalService layers only where
  needed. Do not introduce a replacement universal WalletKeys layer. Keep
  provider selection server-controlled and reject unavailable configurations.
- Configure Platform app ID/key, empty organization-template ID/version (validate
  `spec: {}`), stable OIDC issuer/audience,
  private signing key/key ID, public JWKS and organization email convention. Keep
  all private material server-only; never expose a public JWT-minting endpoint.
- Publish only public JWKS through the server and test issuer-key rotation.
  Keep customer-token renewal and connection recovery internal; public callers
  cannot select arbitrary provider connection IDs or request customer tokens.
- Expose managed-owner authorization through deliberate typed endpoints or request
  variants; preserve existing passkey prepare/complete contracts.
- Apply existing actor permissions, transport limits, and concise error mapping.
- Add bounded observability without credentials, payloads, or provider identifiers
  as metric labels. Read the telemetry architecture before implementation.

**Exit gate:** HTTP tests prove feature gating, authorization, tenant isolation,
idempotency, safe responses, and unchanged passkey behavior.

### Phase 9: dashboard and client integration

Owners: dashboard, SDK, CLI where account assumptions require updates.

- Offer managed custody only when available; skip WebAuthn creation for that mode.
- Display provider/custody accurately and explain recovery/control implications.
- Preserve the account-created page and existing next steps.
- Show the smart-account address as the funding/receive address. Do not present
  the 1Claw owner EOA as the account address. Represent per-network undeployed
  state accurately without requiring a separate owner-EOA funding step.
- Adapt network approval to the managed-owner flow, including pending provider
  approval, retry, and receipt states.
- Keep local-session export/import and local signing intact. Do not remove backup
  steps simply because the parent account is managed.
- Update public SDK contracts and client account-mode validation where required.

**Exit gate:** browser journeys cover both custody modes, account creation retries,
network approval, and errors without claiming an account is usable prematurely.

### Phase 10: end-to-end verification and controlled rollout

- Prove create counterfactual smart account → deploy through a UserOperation
  (which may also install the local session) → confirm session installation →
  execute → revoke/uninstall on explicitly supported test networks. Verify the
  contract account, not the owner EOA, holds assets and session permissions.
- Test signature functionality where permitted, provider outages, disabled owner
  keys, unexpected rotation, and recovery after interrupted provisioning/signing.
- Test two accounts in one org and another isolated org; verify no agent/key or
  customer credential crosses tenants. Test simultaneous first-account requests,
  lost upsert response, subject lookup, already-bootstrapped recovery, customer
  renewal after actual expiry, and refusal after revocation/disconnection. Verify
  zero resources immediately after empty bootstrap and independent agents/keys
  afterward through the uniform path; do not rely on connection `agent_ids`.
- Confirm the organization email delivery/recovery policy with 1Claw and exercise
  it. Verify incremental resource attachment and list completeness at expected
  scale. Do not treat temporary experiment success as a production guarantee.
- Review root-signing permission boundaries, credential handling, and raw-digest
  policy limitations. Provider blind signing does not replace Namera enforcement.
- Document operational disablement, recovery, supported networks, costs, and
  rollback. Disabling new creation must not strand existing account recovery.
- Roll out to selected organizations before wider enablement.
- Update owning architecture documents to describe implemented behavior, not just
  schema support. Keep research checkboxes synchronized with verified evidence.

**Exit gate:** the complete milestone is demonstrated with recorded test evidence,
security review, and an operational recovery procedure. No automatic owner-key
rotation, existing-account migration, or managed-session custody is included.

## Verification and phase handoff

For every implementation phase, record changed contracts, tests run, remaining
limitations, and the next phase's dependencies. Run relevant formatting, lint,
type checks, tests, and builds, plus repository checks for cross-package changes.
Read package READMEs, owning architecture documents, Effect guidance, and testing
conventions before editing their code. Commit each coherent phase separately.

## References

- [Broader 1Claw signer research](1claw-managed-signers.md)
- [Independent wallet-provider boundary](../architecture/wallets/wallet-keys.md)
- [Account creation](../architecture/wallets/accounts.md)
- [EVM account modes](../architecture/evm/accounts/README.md)
- [Session authorization and revocation](../architecture/wallets/session-keys.md)
- [Database catalog](../architecture/database/core-wallets-operations.md)
- [1Claw OpenAPI](https://api.1claw.co/openapi.json)
- [1Claw Platform API](https://docs.1claw.co/docs/platform-api/overview)
- [1Claw signing capabilities](https://1claw.co/intents)

Provider contracts must be rechecked during phase 1. This plan does not provision
resources, enable managed custody, or change runtime behavior.
