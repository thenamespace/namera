import type { SessionKeyView } from "@namera-ai/application";
import type { SessionKeyResponse, SessionKeySummaryResponse } from "@namera-ai/protocol/dto";
import type { SessionKey } from "@namera-ai/protocol/model";

import { toMemberResponse } from "./auth.js";
import { toWalletResponse } from "./wallet.js";

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
