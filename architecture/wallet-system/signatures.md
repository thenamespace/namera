# Message and typed-data signatures

Signing is separate from transaction execution. Supported payloads are UTF-8
messages and EIP-712 typed data in the EVM namespace. There is no public arbitrary
digest-signing endpoint. Provider adapters receive digests only after application
authorization and chain-specific encoding.

## Owner signatures

Owner prepare/complete operations require an authenticated organization owner.
Preparation stores the exact request, request hash, actor, wallet, signing key,
owner binding and expiry in `core.wallet_signature_operation`.

Completion claims a short lease, verifies the binding again and either verifies
a passkey assertion or calls the bound 1Claw signer. Before acceptance it locks
the wallet/key, checks current authority and advances the passkey counter when
applicable. The result is encrypted with operation-specific associated purpose
and persisted with the success audit event. A retry can return that stored result
after the current owner check without signing again.

Owner signatures do not reserve transaction gas. The dashboard uses this flow to
authorize [identity image uploads](identity.md), but the contract is not specific
to that service.

## Delegated signatures

Delegated prepare/complete operations use a selected session key and current
actor grant. The chain installation must permit signatures, and the API signature
policy must explicitly grant the requested payload. Time and chain restrictions
can further narrow that grant.

Preparation stores `core.signature_operation`, binds its grant, policy hash and
payload digest, and reserves one signature unit. Its deadline is bounded by
five minutes, installation expiry and signature policy expiry. Local signers
receive the session's EIP-712 signing request; managed sessions use a server
signing lease and the bound provider credential.

Completion verifies the signature and reloads grant, installation, signer and
policy authority under the wallet lock before settlement. Concurrent revocation
cannot be bypassed by an earlier preparation response.

## Verification

The returned signature is for the smart-account address, not simply the root EOA.
Verification reconstructs that account on the requested chain. Deployed accounts
use ERC-1271; counterfactual accounts supply factory initialization data to the
ERC-6492 verifier. Verification does not load a private signer. Invalid signatures
return false; unavailable chain/account/RPC dependencies remain errors.

## Code

- [Owner prepare](../../packages/application/src/wallet/signatures/prepare.ts)
- [Owner complete](../../packages/application/src/wallet/signatures/complete.ts)
- [Delegated prepare](../../packages/application/src/signature/prepare.ts)
- [Delegated complete](../../packages/application/src/signature/complete.ts)
- [Signature policies](../../packages/application/src/signature/authority.ts)
- [EVM verification](../../packages/evm/src/signing/verify.ts)
