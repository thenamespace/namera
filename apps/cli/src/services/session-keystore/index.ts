import { dirname, join } from "node:path";

import type { ResolveSessionSigner } from "@namera-ai/sdk";
import { Entry } from "@napi-rs/keyring";

import { cliConfigPath } from "../config.js";
import { makeSessionSignerResolver } from "./resolver.js";
import { createSessionKeystore } from "./storage.js";

const entry = (id: string) => new Entry("namera-session-keystore", id);

export const sessionKeystore = createSessionKeystore(join(dirname(cliConfigPath), "session-keys"), {
  get: (id) => entry(id).getPassword(),
  set: (id, secret) => entry(id).setPassword(secret),
  delete: (id) => entry(id).deletePassword(),
});

export const resolveCliSessionSigner = (
  apiOrigin: string,
  maxGasCostWei?: bigint,
): ResolveSessionSigner => makeSessionSignerResolver(sessionKeystore, apiOrigin, maxGasCostWei);
