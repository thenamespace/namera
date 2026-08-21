export const walletPolicy = {
  eip155: {
    derivationChainId: 1,
    algorithm: "p256",
    alchemyModularV2: {
      entryPointVersion: "0.7",
      modularAccountVersion: "2.0.0",
      salt: 0n,
      entityId: 0,
    },
  },
} as const;
