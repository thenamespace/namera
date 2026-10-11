import { createNodeSessionSigner, getSessionKeystore } from "@namera-ai/sdk/node";

export const sessionKeystore = {
  importKey: async (
    ...args: Parameters<Awaited<ReturnType<typeof getSessionKeystore>>["importKey"]>
  ) => (await getSessionKeystore()).importKey(...args),
  readKey: async (...args: Parameters<Awaited<ReturnType<typeof getSessionKeystore>>["readKey"]>) =>
    (await getSessionKeystore()).readKey(...args),
};

export const resolveCliSessionSigner = createNodeSessionSigner;
