import type { WalletView } from "@namera-ai/database";
import type { WalletResponse } from "@namera-ai/protocol/dto";

export const toWalletResponse = (input: WalletView): WalletResponse => {
  const common = {
    id: input.wallet.id,
    organizationId: input.wallet.organizationId,
    metadata: input.wallet.metadata,
    status: input.wallet.status,
    namespace: input.wallet.namespace,
    address: input.wallet.data.address,
    protectionLevel: input.walletKey.protectionLevel,
    createdAt: input.wallet.createdAt,
    updatedAt: input.wallet.updatedAt,
  } as const;

  if (input.wallet.data.implementation === "kernel") {
    return {
      ...common,
      implementation: "kernel",
      data: {
        version: input.wallet.data.version,
        kernelVersion: input.wallet.data.kernelVersion,
        validatorType: input.wallet.data.validatorType,
        entryPointVersion: input.wallet.data.entryPointVersion,
        accountIndex: input.wallet.data.accountIndex,
      },
    };
  }

  return {
    ...common,
    implementation: "safe",
    data: {
      version: input.wallet.data.version,
      safeVersion: input.wallet.data.safeVersion,
      validatorType: input.wallet.data.validatorType,
      entryPointVersion: input.wallet.data.entryPointVersion,
      saltNonce: input.wallet.data.saltNonce,
    },
  };
};
