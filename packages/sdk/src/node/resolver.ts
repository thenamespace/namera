import { Redacted } from "effect";

import { privateKeyToAccount } from "viem/accounts";

import type { ResolveSessionSigner } from "../signing/local-session.js";
import type { createSessionKeystore } from "./storage.js";

export const makeSessionSignerResolver =
  (
    store: Pick<ReturnType<typeof createSessionKeystore>, "readKey">,
    apiOrigin: string,
    maxGasCostWei?: bigint,
  ): ResolveSessionSigner =>
  async (request) => {
    const material = await store.readKey(apiOrigin, request.sessionKeyId);
    const binding = material.bindings.find(
      (installation) =>
        installation.chainId === request.chainId && installation.walletId === request.walletId,
    );
    if (binding === undefined)
      throw new Error("No local installation for the selected wallet and chain.");
    const account = privateKeyToAccount(Redacted.value(material.privateKey));
    return {
      binding,
      ...(maxGasCostWei === undefined ? {} : { maxGasCostWei }),
      signMessage: (message) => account.signMessage({ message }),
      signTypedData: (typedData) => account.signTypedData(typedData),
    };
  };
