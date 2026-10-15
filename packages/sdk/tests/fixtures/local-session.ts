import { Schema } from "effect";

import { LocalEvmSessionBinding, LocalSessionKeyMaterial } from "@namera-ai/protocol/local";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import { localExecutionFixture } from "./local-execution.js";

export const makeLocalSessionMaterial = () => {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const binding = localExecutionFixture().binding;

  return Schema.decodeUnknownSync(LocalSessionKeyMaterial)({
    version: 1,
    namespace: "eip155",
    apiOrigin: "http://localhost:8080",
    privateKey,
    bindings: [
      { ...Schema.encodeSync(LocalEvmSessionBinding)(binding), signerAddress: account.address },
    ],
  });
};
