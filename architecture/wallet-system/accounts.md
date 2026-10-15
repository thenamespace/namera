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

## Creation

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
