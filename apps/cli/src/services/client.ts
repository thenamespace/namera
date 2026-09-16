import { NAMERA_API_ORIGIN, NameraClient } from "@namera-ai/sdk";

import { getProfile } from "./config.js";
import { getValidAccessToken } from "./oauth.js";
import { resolveCliSessionSigner } from "./session-keystore/index.js";

export const makeCliClient = async (profile?: string, maxGasCostWei?: bigint) => {
  const apiKey = process.env.NAMERA_API_KEY;
  if (apiKey !== undefined) {
    const baseUrl = process.env.NAMERA_API_URL ?? NAMERA_API_ORIGIN;
    return {
      config: { activeProfile: "automation", profiles: {} },
      profile: { baseUrl },
      profileName: "automation",
      client: new NameraClient({
        apiKey,
        baseUrl,
        resolveSessionSigner: resolveCliSessionSigner(new URL(baseUrl).origin, maxGasCostWei),
      }),
    };
  }

  const resolved = await getProfile(profile);
  return {
    ...resolved,
    client: new NameraClient({
      baseUrl: resolved.profile.baseUrl,
      getAccessToken: () => getValidAccessToken(resolved.profileName, resolved.profile.baseUrl),
      resolveSessionSigner: resolveCliSessionSigner(
        new URL(resolved.profile.baseUrl).origin,
        maxGasCostWei,
      ),
    }),
  };
};
