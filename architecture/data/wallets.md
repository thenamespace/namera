# Wallet and operation tables

The `core` schema keeps account identity separate from signing custody, delegated
authority, and operation attempts. Namespace-specific data is versioned JSONB
decoded through protocol schemas.

## Accounts and signers

| Table                  | Purpose and important constraints                                                                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `signing_key`          | Public signer, algorithm, custody, purpose and provider reference. Tenant/public-key and managed-key uniqueness; wallet-root and session purposes are distinct.                    |
| `wallet`               | Organization account metadata and namespace account data, linked to a tenant-matching signer and creator.                                                                          |
| `credentials`          | Encrypted 1Claw agent/customer credential payloads and public binding metadata.                                                                                                    |
| `provider_connections` | Organization/provider application connection and readiness; token-owned setup/renewal lease. Ready state requires remote identity, credential and completed setup evidence.        |
| `signer_provisioning`  | Request hash, planned IDs, remote stage and verified signer. Unique organization/actor/provider/purpose/idempotency scope. Planned IDs precede resources and are not foreign keys. |

Provisioning states distinguish pending, remote-started, ready, recovery-required,
and completed. Only ready/completed states have a verified signer; only completion
has a resource ID. Remote ambiguity is retained for recovery, not erased to make
a new provider request.

## Delegation

Revoking a 1Claw session disables its signing key immediately and atomically queues
provider cleanup in `jobs.signing_key_deactivation`. `disabled` records local
authority; it does not imply remote deletion or key destruction. Owner signing
keys are not changed by session revocation.

| Table                            | Purpose and important constraints                                                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `session_key`                    | Wallet, unique session-purpose signer, immutable policies/hash and lifecycle. References bind wallet, signer and actors to the tenant.                             |
| `session_key_grant`              | Actor-to-session authority; one active grant per pair, with revoked history retained.                                                                              |
| `session_key_installation`       | Per-chain compiled authority and receipt evidence. Unique session/chain and wallet/chain/entity bindings. Installed/revoked states require corresponding receipts. |
| `session_key_policy_state`       | Versioned policy state unique by organization/session/policy/state key, with revision for conditional writes.                                                      |
| `session_key_policy_reservation` | In-flight policy hold for exactly one execution submission or signature operation; unique operation/policy/state scope.                                            |

## Operation ledgers

| Table                        | Purpose and important constraints                                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `execution_submission`       | Actor-idempotent delegated attempt, exact grant binding, unsigned/signed envelope and reconciliation lease.                               |
| `execution`                  | Append-only successful execution; unique submission and tenant/grant binding.                                                             |
| `signature_operation`        | Delegated signing preparation, grant and policy binding, expiry, result status and managed signing lease.                                 |
| `wallet_operation`           | Owner transaction preparation, approval, broadcast evidence, receipt and lease. One pending operation per wallet/chain within this table. |
| `session_key_operation`      | Owner-approved install/uninstall attempt bound to installation/wallet/chain/tenant; one pending wallet/chain operation within this table. |
| `wallet_signature_operation` | Owner message/typed-data approval and encrypted completed result; actor-idempotent request and signing lease.                             |

Owner operation checks bind signed data to prepared data except signature/hash
fields. Failed rows without transaction hashes require explicit submission
rejection evidence. Cancellation/expiry apply to unsigned states. Cross-ledger
wallet/chain serialization is enforced by application locking, not a unique index
spanning multiple tables.

Workers claim eligible rows with leases and condition updates on lease ownership.
A missing receipt is not a terminal database transition. Reservations and signed
envelopes remain available until authoritative resolution.

Source: [core schema](../../packages/database/src/schema/core/),
[core repositories](../../packages/database/src/repositories/core/).
