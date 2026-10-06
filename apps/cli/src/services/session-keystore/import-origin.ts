import { NAMERA_API_ORIGIN } from "@namera-ai/sdk";

import { readCliConfig } from "#/services/config";
import { cliFailure } from "#/services/error-feedback";

/** Resolve the expected origin independently of the encrypted export, without authorization. */
export const sessionKeyImportOrigin = async (profile: string, host?: string): Promise<string> => {
  const explicitHost = host ?? process.env.NAMERA_API_URL;
  if (explicitHost) return new URL(explicitHost).origin;

  const config = await readCliConfig();
  const saved = config.profiles[profile];
  if (!saved && profile !== "personal") {
    throw cliFailure("PROFILE_REQUIRED");
  }
  return new URL(saved?.baseUrl ?? NAMERA_API_ORIGIN).origin;
};
