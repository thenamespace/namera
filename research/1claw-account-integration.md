# 1Claw managed account integration plan

Status: phase 3 persistence implemented; runtime integration not enabled. Updated: 10 October 2026.

Implement 1Claw-managed account owners first. Managed session-key custody is a
later project. The first complete milestone is a managed account that can install
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
- Target the existing internal secp256k1/EIP-7702 account path, subject to phase 1
  compatibility verification. Do not silently introduce Safe or another account
  implementation if that path fails.
- Do not migrate or rotate existing passkey account owners.

### Package decision

Extend `packages/wallet-keys` with a focused 1Claw provider implementation. Its
existing service already owns key creation, signing, disablement, and destruction.
Follow the package's current provider layout; do not reorganize other providers
solely to add this one.

```text
server: configuration and live provider composition
  application: account provisioning and owner authorization
    wallet-keys: 1Claw client, authentication, key lifecycle, signing
    evm: account construction, digests, signature formatting, submission
    database: tenant-scoped signer and encrypted credential persistence
  api / protocol: public contracts and typed models
```

Do not create `packages/oneclaw` initially. Reconsider only if independent 1Claw
capabilities, such as vault management, need a shared provider package. Application
and EVM must not import a 1Claw SDK or HTTP client directly.

Custody, provider, algorithm, and account implementation are separate concepts:

| Concept                         | Proposed value                           |
| ------------------------------- | ---------------------------------------- |
| Custody                         | `namera-managed`                         |
| Provider metadata discriminator | `1claw`                                  |
| Owner purpose                   | `wallet-root`                            |
| Owner algorithm                 | `secp256k1`                              |
| Account implementation          | Alchemy Modular Account V2               |
| Account mode                    | EIP-7702, subject to compatibility proof |

Do not force 1Claw into the current `hsm` protection label. Confirm actual key
generation, storage, signing, export, and TEE/HSM guarantees, then model them
accurately.

## Phase tracker

Complete phases in order. Each phase should be a reviewable change with its own
verification evidence; later phases must not bypass an unresolved earlier gate.

- [ ] Phase 1: provider and account compatibility
- [x] Phase 2: protocol contracts
- [x] Phase 3: persistence and recovery model
- [ ] Phase 4: 1Claw key-provider implementation
- [ ] Phase 5: EVM managed-owner integration
- [ ] Phase 6: account provisioning workflow
- [ ] Phase 7: managed-owner session authorization
- [ ] Phase 8: API and runtime exposure
- [ ] Phase 9: dashboard and client integration
- [ ] Phase 10: end-to-end verification and controlled rollout

### Phase 1: provider and account compatibility

Use an explicitly authorized disposable provider agent/key. Do not use production
funds. Extend the previously reported digest experiment with reproducible vectors.

- Confirm management authentication: organization API or Platform connections.
- Decide how Namera organizations map to provider tenants and agents.
- Confirm one dedicated agent/key per account owner, creation limits, signing
  quotas, billing, incremental provisioning, and credential rotation.
- Verify public-key encoding, derived address, exact digest signing without extra
  hashing, signature encoding, parity, and low-S normalization.
- Verify signing the exact EIP-7702 authorization digest expected by our adapter.
- Confirm stable key/version selection and behavior after provider key rotation.
- Establish provisioning/signing retry semantics, lookup after ambiguous timeout,
  approval-required responses, and deactivation versus destruction.
- Confirm custody/export guarantees and required raw-signing configuration.

**Exit gate:** record supported primitives, verified test vectors, enterprise
constraints, account-mode choice, credential strategy, and unresolved blockers in
the research note. Do not proceed on assumed P-256 support or an unverified
protection label. A failed EIP-7702 compatibility gate requires a new account-mode
decision, not a silent fallback.

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

### Phase 3: persistence and recovery model

Owners: `packages/database`, protocol persistence models.

- Extend `core.signing_key` discriminator/custody checks for 1Claw metadata.
- Retain `core.wallet.signing_key_id` and existing tenant-safe relationships.
- Add a provider-tenant mapping only if required by the selected management model.
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
- Keep private keys and temporary JWTs out of the database; do not duplicate signer
  identity in a competing provider-wallet table.

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

### Phase 4: 1Claw key-provider implementation

Owner: `packages/wallet-keys`.

- Implement management/signing authentication, token refresh, and key provisioning
  or recovery using the phase 1 contract.
- Validate external public material and derive/compare the returned signer address.
- Implement exact digest signing and only other operations genuinely supported.
- Adapt signature formats to the existing provider boundary; keep Ethereum-specific
  encoding and parity handling in EVM. Avoid double hashing or prefixing.
- Implement bounded timeouts/retries and typed failures. Do not retry ambiguous
  non-idempotent provisioning blindly.
- Fail explicitly for unsupported destruction; never claim deactivation destroyed
  key material. Handle approval-required responses as a distinct outcome.
- Supply a package-owned deterministic test layer and sanitized provider fixtures.

**Exit gate:** provider tests cover wrong-key responses, rotation, invalid encoding,
auth expiry, rate limits, outages, and lifecycle semantics. No credentials appear
in logs, traces, errors, or fixtures.

### Phase 5: EVM managed-owner integration

Owner: `packages/evm`.

- Wire the managed secp256k1 digest signer into the existing owner adapter.
- Verify creation/reconstruction and persisted-address consistency.
- Implement or complete the EIP-7702 delegation authorization path, including
  chain/nonce binding and the explicitly supported delegation implementation.
- Verify owner-operation signing and signature recovery against the stored key.
- Define supported networks and reject unsupported ones before signing.
- Keep account registration distinct from per-network onchain readiness.

**Exit gate:** unit and fork/integration tests prove authorization encoding,
delegation, reconstruction, and rejection of substituted account/key/network data.
Existing P-256 account tests remain green.

### Phase 6: account provisioning workflow

Owner: `packages/application`.

1. Authorize the actor and precheck managed-account entitlement/capacity.
2. Allocate local signing-key and credential IDs for the request.
3. Provision one dedicated provider agent and protect its credential.
4. Provision one Ethereum key, enable raw signing and validate its identity.
5. Construct the selected EVM account.
6. Lock billing state, repeat capacity checks, and atomically persist the signer,
   credential, wallet, required audits and notifications.
7. Report partial or ambiguous failures for manual recovery. Never blindly retry
   remote creation or claim that a remote resource was rolled back.

Keep remote calls outside long database transactions. Use provider idempotency
only if verified; a local transaction does not make remote creation atomic.
Never destroy a provider key automatically if it might control a funded account.

**Exit gate:** workflow tests cover concurrent capacity checks, provider success
followed by database failure, lost responses and safe orphan handling. Successful
local account, credential, signer and audit writes are atomic; ambiguous remote
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
- Adapt network approval to the managed-owner flow, including pending provider
  approval, retry, and receipt states.
- Keep local-session export/import and local signing intact. Do not remove backup
  steps simply because the parent account is managed.
- Update public SDK contracts and client account-mode validation where required.

**Exit gate:** browser journeys cover both custody modes, account creation retries,
network approval, and errors without claiming an account is usable prematurely.

### Phase 10: end-to-end verification and controlled rollout

- Prove create managed account → authorize network/delegation → install local
  session → execute → revoke/uninstall on explicitly supported test networks.
- Test signature functionality where permitted, provider outages, disabled owner
  keys, unexpected rotation, and recovery after interrupted provisioning/signing.
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
- [Wallet-key provider boundary](../architecture/wallets/wallet-keys.md)
- [Account creation](../architecture/wallets/accounts.md)
- [EVM account modes](../architecture/evm/accounts/README.md)
- [Session authorization and revocation](../architecture/wallets/session-keys.md)
- [Database catalog](../architecture/database/core-wallets-operations.md)
- [1Claw OpenAPI](https://1claw.co/openapi.json)
- [1Claw Platform API](https://docs.1claw.co/docs/platform-api/overview)
- [1Claw signing capabilities](https://1claw.co/intents)

Provider contracts must be rechecked during phase 1. This plan does not provision
resources, enable managed custody, or change runtime behavior.
