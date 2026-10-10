import type { WalletView } from "@namera-ai/database";
import type { WalletResponse } from "@namera-ai/protocol/dto";

export const toWalletResponse = (input: WalletView): WalletResponse => {
  if (
    input.signingKey.data.type === "1claw" &&
    (input.signingKey.algorithm !== "secp256k1" || input.signingKey.data.chain !== "ethereum")
  ) {
    throw new Error("EVM wallet requires an Ethereum secp256k1 owner");
  }
  const owner =
    input.signingKey.custody === "local"
      ? {
          signingKeyId: input.signingKey.id,
          custody: "local" as const,
          algorithm: input.signingKey.algorithm,
        }
      : input.signingKey.data.type === "1claw"
        ? {
            signingKeyId: input.signingKey.id,
            custody: "namera-managed" as const,
            provider: "1claw" as const,
            algorithm: "secp256k1" as const,
          }
        : {
            signingKeyId: input.signingKey.id,
            custody: "namera-managed" as const,
            algorithm: input.signingKey.algorithm,
            protectionLevel: input.signingKey.data.protectionLevel,
          };
  const common = {
    id: input.wallet.id,
    organizationId: input.wallet.organizationId,
    metadata: input.wallet.metadata,
    status: input.wallet.status,
    namespace: input.wallet.namespace,
    address: input.wallet.data.address,
    owner,
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

  if (input.wallet.data.accountMode === "factory") {
    return {
      ...common,
      implementation: "alchemy-modular-v2",
      data: {
        version: input.wallet.data.version,
        modularAccountVersion: input.wallet.data.modularAccountVersion,
        validatorType: input.wallet.data.validatorType,
        entryPointVersion: input.wallet.data.entryPointVersion,
        accountMode: input.wallet.data.accountMode,
        factoryVersion: input.wallet.data.factoryVersion,
        implementationVersion: input.wallet.data.implementationVersion,
        ownerAddress: input.wallet.data.ownerAddress,
        salt: input.wallet.data.salt,
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
