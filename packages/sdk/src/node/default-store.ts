import { join } from "node:path";

import { nameraConfigDirectory } from "./config-directory.js";
import { createSessionKeystore } from "./storage.js";

export const getSessionKeystore = async () => {
  // Load native code only when local custody is actually used.
  const { Entry } = await import("@napi-rs/keyring");
  const entry = (id: string) => new Entry("namera-session-keystore", id);
  return createSessionKeystore(join(nameraConfigDirectory(), "session-keys"), {
    get: (id) => entry(id).getPassword(),
    set: (id, secret) => entry(id).setPassword(secret),
    delete: (id) => entry(id).deletePassword(),
  });
};
