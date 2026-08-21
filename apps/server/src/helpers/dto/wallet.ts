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

  if (input.wallet.data.validatorType === "webauthn_p256") {
    return {
      ...common,
      implementation: "alchemy-modular-v2",
      data: {
        version: input.wallet.data.version,
        modularAccountVersion: input.wallet.data.modularAccountVersion,
        validatorType: input.wallet.data.validatorType,
        entryPointVersion: input.wallet.data.entryPointVersion,
        salt: input.wallet.data.salt,
        entityId: input.wallet.data.entityId,
      },
    };
  }

  return {
    ...common,
    implementation: "alchemy-modular-v2",
    data: {
      version: input.wallet.data.version,
      modularAccountVersion: input.wallet.data.modularAccountVersion,
      validatorType: input.wallet.data.validatorType,
      entryPointVersion: input.wallet.data.entryPointVersion,
      accountMode: input.wallet.data.accountMode,
      delegationVersion: input.wallet.data.delegationVersion,
    },
  };
};
