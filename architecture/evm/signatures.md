# EVM signatures and verification

The EVM adapter supports fully discriminated personal-message and EIP-712 typed-data operations. Application workflows apply session-key grants/policies, quota/idempotency, persistence, audit, and billing before calling the adapter.

## Digest

`digestEvmSignature` maps:

- message → Viem `hashMessage`;
- typed data → Viem `hashTypedData`.

The result is decoded as protocol `Bytes32`. Digesting is reusable for canonical request hashing/policy context and does not call a provider.

## Signing

```mermaid
sequenceDiagram
  participant App as Signature application
  participant EVM as EVM signature adapter
  participant RPC as Public client
  participant Account as Reconstructed Kernel/Safe
  participant Owner as Wallet-key signer
  App->>EVM: chain, account data, message or typed data
  EVM->>EVM: Resolve supported chain
  EVM->>Account: Reconstruct using RPC and owner
  EVM->>EVM: Verify derived address equals stored address
  alt message
    EVM->>Account: signMessage
  else typed data
    EVM->>Account: signTypedData
  end
  Account->>Owner: Sign account-specific payload
  Owner-->>Account: Signature
  EVM-->>App: Protocol Hex signature
```

Reconstruction errors map to `ACCOUNT_RECONSTRUCTION_FAILED` or `ACCOUNT_ADDRESS_MISMATCH`; owner signing failures map to `SIGNING_FAILED`.

## ERC-1271-compatible verification

Verification is account-aware, not an EOA `recoverAddress` shortcut:

1. resolve chain and reconstruct the exact smart account;
2. read code at the account address;
3. when undeployed, obtain account factory/factoryData for counterfactual verification;
4. call Viem `publicClient.verifyMessage` or `verifyTypedData` with address, signature, payload, and optional factory args;
5. return boolean validity; provider/contract errors map to `VERIFICATION_FAILED`.

This supports deployed ERC-1271 accounts and counterfactual smart-account signatures. A signature may be cryptographically valid for the underlying owner but invalid for the smart account if its validator/account configuration differs.

## Application operation lifecycle

The application stores one [`core.signature_operation`](../database/core-wallets-operations.md#coresignature_operation) per idempotent attempt. It binds actor, wallet, session key/grant, policy hash, discriminated request data, lifecycle status, and failure code. Raw private key material is never present. The operation is the source owner for an anniversary-period billing reservation and supports historical inspection without using telemetry as billing evidence.

Signature policy evaluation requires at least one signature operation that explicitly `grantsAccess`; time-window and chain-allowlist policies can restrict signatures but do not independently enable them.

## Idempotency and quota

- SDK/CLI/MCP generate a key internally and reuse it for automatic retries of the same logical signature.
- Application canonical request hash rejects different input under the same actor/key.
- Monthly signature quotas count successful operations in the effective billing window.
- Reservation/failure lifecycle prevents an interrupted attempt from silently becoming unlimited free work.

## Pending before production

- Add conformance fixtures for popular ERC-1271 consumers and counterfactual verification paths.
- Define retention/redaction for signed message and typed-data content, especially personal data.
- Add optional domain/contract allowlist policies before broad typed-data production use.
- Add periodic signature-count policy if per-session-key daily limits are launched.
