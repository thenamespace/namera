---
"@namera-ai/contracts": minor
---

`WebAuthnValidator`: Namera's ERC-7579 validator for passkey owners on Kernel, Nexus and Safe7579, and stateless passkey
verifier for Smart Sessions session keys (`WebAuthnValidator.v1`).

- Up to 16 passkeys per account with a threshold, managed by the account (`addPasskey`, `removePasskey`,
  `setThreshold`).
- ERC-1271 signatures are bound to the account and chain (`replaySafeHash`).
- A multichain mode lets one passkey assertion approve user operations on several chains (`multichainChallenge`).
- P-256 verification through the RIP-7212 / EIP-7951 precompile or in Solidity, chosen by the signer.

`External` no longer lists ZeroDev's WebAuthn validator.
