import { Schema } from "effect";

import { ApplicationRelativePath } from "@namera-ai/protocol";

import type { AuthConfigValue } from "./config.js";

export function normalizeAuthReturnTo(
  input: string | undefined,
  config: Pick<AuthConfigValue, "dashboardPublicOrigin" | "returnTo">,
): string {
  if (!Schema.is(ApplicationRelativePath)(input)) return config.returnTo.defaultPath;

  const url = new URL(input, config.dashboardPublicOrigin);
  const path = `${url.pathname}${url.search}${url.hash}`;
  // Dot segments can turn an initially relative path into a network-path
  // reference when the normalized pathname is later resolved a second time.
  if (
    url.origin !== config.dashboardPublicOrigin.origin ||
    !Schema.is(ApplicationRelativePath)(path) ||
    !config.returnTo.allowedPrefixes.some(
      (prefix) =>
        url.pathname === prefix || (prefix !== "/" && url.pathname.startsWith(`${prefix}/`)),
    )
  ) {
    return config.returnTo.defaultPath;
  }

  return path;
}
