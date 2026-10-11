import type { ResolveSessionSigner } from "../signing/local-session.js";

export const createNodeSessionSigner =
  (apiOrigin: string, maxGasCostWei?: bigint): ResolveSessionSigner =>
  async (request) => {
    const [{ getSessionKeystore }, { makeSessionSignerResolver }] = await Promise.all([
      import("./default-store.js"),
      import("./resolver.js"),
    ]);
    return makeSessionSignerResolver(await getSessionKeystore(), apiOrigin, maxGasCostWei)(request);
  };
