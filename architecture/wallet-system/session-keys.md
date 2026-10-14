# Session keys

A session key delegates account authority to a secp256k1 signer. Its configuration,
onchain installations and API grants are separate records. Creating a session does
not install it or grant an arbitrary API actor access.

## Authority

The signer is either caller-held (`local`) or managed by 1Claw. Each configured
chain gets an installation with its own validator entity, validity window and
permissions. The account owner approves installation and removal through the
transaction review flow.

Delegated execution and signing require all of:

- A current, unrevoked grant for the authenticated actor and selected session.
- An active session and signing key in the requested organization and wallet.
- An installed configuration on the requested chain, within its validity window.
- A supported signer and active account owner; managed signing also checks the
  provider connection and credential binding.

Authority is reloaded at acceptance under the wallet lock. A grant read earlier
in the HTTP request is not enough to admit an operation after revocation.

## Installation and revocation

The EVM compiler derives install/uninstall calldata from persisted authorization.
Preparation produces a zero-value account self-call, never client-supplied install
calldata. Passkey owners sign a verified WebAuthn challenge; managed owners use
the server signer after confirmation. The dashboard independently reconstructs
the reviewed configuration before approval.

Installation moves from `pending` through `submitted` to `installed` only after
a matching successful receipt. Removal uses `revoking` and `revoked`; failures
remain distinguishable from successful removal.

Revoking API access immediately revokes active grants and cancels unsigned
installation requests. It does not erase onchain authority. Installed permissions
must be removed on every installed network. Signed operations remain subject to
receipt reconciliation, including during revocation.

## Persistence

| Table (`core`)             | Responsibility                                                                  |
| -------------------------- | ------------------------------------------------------------------------------- |
| `session_key`              | Wallet, signer, immutable configuration and policy hash, lifecycle              |
| `session_key_grant`        | Actor-specific delegated access and revocation                                  |
| `session_key_installation` | Chain, validator entity, authorization, install/remove hashes and receipt state |
| `session_key_operation`    | Owner approval, prepared/signed envelope, submission marker and worker lease    |

An installation is unique per session and chain. Validator entities are unique
per wallet and chain and are never reused after revocation: old signatures can
still exist. Composite foreign keys preserve organization, wallet and session
bindings.

## Code

- [Creation](../../packages/application/src/session-key/create.ts)
- [Authority loader](../../packages/application/src/session-key/authority.ts)
- [Owner operation preparation](../../packages/application/src/session-key/prepare-operation.ts)
- [Revocation](../../packages/application/src/session-key/revoke.ts)
- [Permission compiler](../../packages/evm/src/sessions/compile.ts)

See [policies](policies.md), [transactions](transactions.md) and
[reconciliation](reconciliation.md).
