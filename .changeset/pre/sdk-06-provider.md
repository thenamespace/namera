---
"@namera-ai/sdk": minor
---

`Grant.toProvider({ grant, signer, client, bundler, paymaster? })` (and the Effect API's `Grant.toProvider`) wraps the
agent's account in an EIP-1193 provider for wagmi, viem's `custom` transport and other wallet-expecting tools. It
answers the account and chain, EIP-5792 2.0.0 (`wallet_sendCalls` as one atomic user operation, with ERC-7677
`paymasterService` sponsorship through `Paymaster.erc7677`; `wallet_getCallsStatus` with 100 pending, 200 confirmed,
400 dropped and 500 reverted; `wallet_getCapabilities`), `eth_signTypedData_v4` with session signatures, and forwards
reads to the client's node. Anything that would sign or send otherwise is refused with 4200, and policy refusals are
4100 with `NameraError.toJSON(error)` as `data`.
