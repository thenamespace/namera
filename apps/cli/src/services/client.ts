import { NameraClient } from "@namera-ai/sdk";

import { getProfile } from "./config.js";
import { getValidAccessToken } from "./oauth.js";

export const makeCliClient = async (profile?: string) => {
  const apiKey = process.env.NAMERA_API_KEY;
  if (apiKey !== undefined) {
    const baseUrl = process.env.NAMERA_API_URL ?? "http://localhost:8080";
    return {
      config: { activeProfile: "automation", profiles: {} },
      profile: { baseUrl },
      profileName: "automation",
      client: new NameraClient({ apiKey, baseUrl }),
    };
  }

  const resolved = await getProfile(profile);
  return {
    ...resolved,
    client: new NameraClient({
      baseUrl: resolved.profile.baseUrl,
      getAccessToken: () => getValidAccessToken(resolved.profileName, resolved.profile.baseUrl),
    }),
  };
};
