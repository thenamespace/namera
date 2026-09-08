import { Schema } from "effect";

import { LocalSessionKeyMaterial } from "@namera-ai/protocol/local";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export const makeLocalSessionMaterial = () => {
  const privateKey = generatePrivateKey();
  return Schema.decodeUnknownSync(LocalSessionKeyMaterial)({
    version: 1,
    namespace: "eip155",
    apiOrigin: "http://localhost:8080",
    privateKey,
    bindings: [
      {
        walletId: "01950000-0000-7000-8000-000000000001",
        sessionKeyId: "01950000-0000-7000-8000-000000000002",
        signingKeyId: "01950000-0000-7000-8000-000000000003",
        installationId: "01950000-0000-7000-8000-000000000004",
        walletAddress: `0x${"11".repeat(20)}`,
        signerAddress: privateKeyToAccount(privateKey).address,
        chainId: "eip155:11155111",
        entityId: 7,
        isGlobal: true,
        hasExecutionHooks: false,
        validAfter: "2026-09-08T00:00:00Z",
        validUntil: "2026-10-08T00:00:00Z",
      },
    ],
  });
};
