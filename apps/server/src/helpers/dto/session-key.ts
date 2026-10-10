import type { SessionKeyView } from "@namera-ai/application";
import type {
  EvmSessionSignerResponse,
  SessionKeyResponse,
  SessionKeySummaryResponse,
} from "@namera-ai/protocol/dto";
import type { SessionKey, SigningKey } from "@namera-ai/protocol/model";

import { toMemberResponse } from "./auth.js";
import { toWalletResponse } from "./wallet.js";

export const toSessionSignerResponse = (key: SigningKey): EvmSessionSignerResponse => {
  if (key.purpose !== "session" || key.algorithm !== "secp256k1") {
    throw new Error("Invalid EVM session signer binding");
  }
  const publicKey = key.publicKeyHex;
  if (key.custody === "local" && key.data.type === "local-key") {
    return { custody: "local", algorithm: "secp256k1", publicKey };
  }
  if (
    key.custody === "namera-managed" &&
    key.data.type === "1claw" &&
    key.data.chain === "ethereum"
  ) {
    return { custody: "namera-managed", provider: "1claw", algorithm: "secp256k1", publicKey };
  }
  throw new Error("Unsupported EVM session signer custody");
};

export const toSessionKeySummaryResponse = (sessionKey: SessionKey): SessionKeySummaryResponse => ({
  id: sessionKey.id,
  organizationId: sessionKey.organizationId,
  walletId: sessionKey.walletId,
  signingKeyId: sessionKey.signingKeyId,
  namespace: sessionKey.namespace,
  metadata: sessionKey.metadata,
  policies: sessionKey.policies,
  policyHash: sessionKey.policyHash,
  status: sessionKey.status,
  revokedAt: sessionKey.revokedAt,
  createdAt: sessionKey.createdAt,
});

export const toSessionKeyResponse = (input: SessionKeyView): SessionKeyResponse => ({
  ...toSessionKeySummaryResponse(input.sessionKey),
  signer: toSessionSignerResponse(input.signingKey),
  wallet: toWalletResponse(input.wallet),
  creator: toMemberResponse(input.creator),
  installations: input.installations.map((installation) => ({
    id: installation.id,
    chainId: installation.chainId,
    status: installation.status,
    authorization: installation.data.authorization,
    installTransactionHash: installation.installTransactionHash,
    uninstallTransactionHash: installation.uninstallTransactionHash,
  })),
});
