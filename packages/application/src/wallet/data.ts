export const walletPolicy = {
  eip155: {
    derivationChainId: 1,
    algorithm: "p256",
    kernel: {
      entryPointVersion: "0.7",
      kernelVersion: "0.3.3",
      accountIndex: 0n,
    },
    safe: {
      entryPointVersion: "0.7",
      safeVersion: "1.4.1",
      saltNonce: 0n,
    },
  },
} as const;
