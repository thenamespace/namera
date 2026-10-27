# Accounts and custody

An account is an organization-scoped smart wallet. The dashboard calls it an
account; contracts and persistence use `wallet`. Its root signing key is separate
from the account address and from delegated session keys.

## Account implementation

The implemented namespace is `eip155`. Accounts use Alchemy Modular Account V2
and EntryPoint 0.7. Creation derives the address and stores reconstruction
metadata; it does not deploy a contract. The first onchain operation can deploy it.

| Owner         | Account construction          | Signing material                                                                  |
| ------------- | ----------------------------- | --------------------------------------------------------------------------------- |
| User passkey  | P-256 WebAuthn validator      | Authenticator; server stores public key, credential ID, RP ID and counter         |
| 1Claw managed | Factory-derived ECDSA account | 1Claw agent and Ethereum signing key; encrypted agent credential stored by Namera |

GCP and filesystem provider implementations exist, but the server composes their
disabled layers. They are not alternatives selected automatically when 1Claw fails.

The EVM adapter receives public reconstruction data and signing callbacks. It
does not load database credentials or choose a custody provider. Application
workflows call each provider's explicit service.

## Networks

Arc mainnet (`eip155:5042`) and testnet (`eip155:5042002`) use the existing
factory ECDSA and passkey account paths. Chain configuration remains in the EVM
registry; custody providers continue signing exact chain-bound digests.

Read-only Alchemy checks on 27 October 2026 confirmed both chain IDs, EntryPoint
0.7 support, and bytecode at the pinned factories, ECDSA implementation, WebAuthn
validator and five permission modules. Both networks returned matching bytecode
for those addresses. Fee quotes, Portfolio API, basic `eth_simulateV1`, and
USDC/USD pricing were available. These checks did not submit operations and do
not establish a mined BSO-sponsored owner or session execution. Hosted sponsorship
must be enabled on the configured BSO policy for both Arc networks.

## Creation

The SDK supports 1Claw and passkey account creation through scoped API-key actors.
`wallet:create` is explicit workspace authority; the account still belongs to the
organization. API-key passkey ceremonies use issuance-approved origins, and signer
records retain the verified origin. Legacy dashboard ceremonies remain user-bound.
See [delegated access](../identity-access/delegated-access.md).

1. Check the organization's account allowance.
2. Verify the passkey registration, or provision the managed signer.
3. Derive the smart-account address without signing.
4. Lock organization billing and repeat the limit check.
5. Persist the signing key and wallet, consume registration/provisioning state,
   and write audit and notification jobs in the transaction.

Managed provisioning is durable. Its request hash and idempotency key bind the
attempt to the actor and requested resource. Leases prevent concurrent creation.
The one-time agent credential is encrypted and persisted before a subsequent key
creation call. An uncertain provider mutation requires recovery, not blind retry.

### 1Claw customer authorization

Customer JWTs, agent keys and customer authorization passwords are separate encrypted
credentials. JWT renewal never replaces the password. Initial password setup is
limited to the Namera organization OIDC subject and runs under the connection lease.
The generated password is persisted before the provider call, with encryption bound
to its organization and credential ID. If setup already completed remotely, the same
saved password must authenticate the same customer. Unknown passwords require
operator recovery; Namera never resets an existing password automatically.

Password setup can invalidate an otherwise unexpired customer JWT. Setup therefore
renews and verifies customer authority before handing it to provisioning. A 401 on
the initial identity check also permits one claim renewal under the connection lease;
other errors and a second 401 fail closed. Agent/key mutations are never replayed
as part of token renewal.

Agent setup uses customer `PATCH /v1/agents/{id}` with a request-scoped
`X-Auth-Confirm` password and explicit `raw_signing_policy: allow`. Read-back must
confirm an active agent, enabled intents and raw signing, and the allow policy.
Authorization is setup, not a per-signature login. Existing working signers retain
their agent credentials and keys; signing still checks fresh local authority and
the pinned remote key before verifying the returned signature.

Provisioning checkpoints retain the key identity and provider approval reference.
Retrying the same request can resume after saving the agent credential or after
raw-signing setup failed, without creating another agent or key. Uncertain remote
agent/key creation remains quarantined. Approval responses are not success. A saved
approval is checked through agent read-back on retry, not submitted again; consensus
approvals requiring separate confirmation remain operator recovery work.

Authorization credential creation and status changes emit `provider_credential.saved`
in the same transaction. No password, JWT, provider body or signature is logged.

### Dev validation and existing signers

Apply the migration through normal server startup before testing. No new environment
secret is needed. Test managed account and session-key creation, owner signatures,
owner transaction confirmation, session installation and session execution in dev.
Provider fixture tests do not establish that the deployed 1Claw tenant permits
initial password setup or unattended signing.

Retry interrupted creation with the original idempotency key and unchanged request.
Do not delete its provisioning row or credentials. Legacy attempts at
`raw_signing_started` can recover by listing the bound agent's single active key;
ambiguous `agent_create_started` and `key_create_started` attempts cannot.

An operator can inspect an existing active signer without changing its policy:

```sh
pnpm --filter @namera-ai/server oneclaw:signer <organization-id> <signing-key-id>
```

The check may renew expired customer authority. It is not a public HTTP endpoint.
If it reports `authorization_required`, repeat with `--apply` to authorize that
signer. It does not rotate keys, change addresses, or send transactions. Inactive,
denied and approval-required agents are blocked. If apply returns an approval
requirement, resolve it with the provider before another apply; the command does
not approve requests or bypass tenant policy.

Working signers need no repair. Back up the authorization credential alongside
existing credentials and retain the encryption configuration. Unknown passwords,
identity mismatches, MFA and tenant policy restrictions require explicit recovery,
not automatic resets or fallback providers.

## Persistence

| Table (`core`)         | Responsibility                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------- |
| `wallet`               | Organization, root signing key, metadata, status, versioned account reconstruction data |
| `signing_key`          | Purpose, algorithm, public key, custody and provider locator                            |
| `provider_connections` | Organization's provider association and setup state                                     |
| `credentials`          | Encrypted provider credentials and their bindings                                       |
| `signer_provisioning`  | Idempotent remote provisioning, leases and resulting resource                           |

Composite foreign keys bind related resources to the same organization. Public
wallet responses expose the owner descriptor needed for review, not credentials.

## Code

- [Creation](../../packages/application/src/wallet/create.ts)
- [Managed provisioning](../../packages/application/src/oneclaw/provision.ts)
- [Provisioning lifecycle](../../packages/application/src/provisioning/lifecycle.ts)
- [Account reconstruction](../../packages/evm/src/accounts/reconstruct.ts)
- [Server layers](../../apps/server/src/layers/services.ts)

See [session keys](session-keys.md) for delegated authority and
[signatures](signatures.md) for owner approval.
