---
"@namera-ai/contracts": minor
---

First release: the ABIs, CREATE2 addresses and deployment records of Namera's v2 contracts, deployed and verified
(Sourcify and Etherscan) at the same address on Base, Sepolia, Base Sepolia, Arbitrum Sepolia and OP Sepolia. The
contracts are unaudited: they have had internal security reviews only.

- Each contract is a namespace with one export per version (`SmartSession.v1`: `abi`, `address`, and `deployments` by
  chain id). Each part is also its own export, `abiV1`, `errorsV1` (the ABI's error fragments), `addressV1` (a
  literal type) and `deploymentsV1`, so a bundle that imports `@namera-ai/contracts/SmartSession` keeps only what it
  uses. `Contract.Version`, `Contract.Deployment` and `Contract.Compiler` type them.
- `External`: the addresses of the contracts Namera builds on, by version: EntryPoint 0.7, and Kernel 3.3's factory,
  ZeroDev's staked FactoryStaker, the implementation and the ECDSA validator.
