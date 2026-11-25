---
"@namera-ai/contracts": minor
"@namera-ai/sdk": patch
---

Each contract version's parts are also their own exports: `abiV1`, `errorsV1` (the ABI's error fragments, in ABI order),
`addressV1` (the address as a literal type) and `deploymentsV1`, which `v1` is now built from (`SmartSession.v1.abi ===
SmartSession.abiV1`). Imported from a contract's subpath, they let esbuild, tsup and Bun keep only what is used: an
address alone is 0.6 KB gzip instead of 2.9 KB with the whole `v1` record. Deployment block numbers are marked pure, so
unused deployment records drop out too. The SDK reads the flat exports and decodes reverts from the error fragments only:
about 2 KB gzip less wherever it decodes errors (`NameraError.decode`, `Bundler`, `Paymaster`, agents), and up to 10 KB
less in esbuild bundles of `Session`, `KernelAccount` and the owner flow.
