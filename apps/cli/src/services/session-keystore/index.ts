import { dirname, join } from "node:path";

import { Redacted } from "effect";

import type { ResolveSessionSigner } from "@namera-ai/sdk";
import { Entry } from "@napi-rs/keyring";
import { privateKeyToAccount } from "viem/accounts";

import { cliConfigPath } from "../config.js";
import { createSessionKeystore } from "./storage.js";

const entry = (id: string) => new Entry("namera-session-keystore", id);

export const sessionKeystore = createSessionKeystore(join(dirname(cliConfigPath), "session-keys"), {
  get: (id) => entry(id).getPassword(),
  set: (id, secret) => entry(id).setPassword(secret),
  delete: (id) => entry(id).deletePassword(),
});

export const resolveCliSessionSigner =
  (apiOrigin: string, maxGasCostWei?: bigint): ResolveSessionSigner =>
  async (request) => {
    const material = await sessionKeystore.readKey(apiOrigin, request.sessionKeyId);
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
