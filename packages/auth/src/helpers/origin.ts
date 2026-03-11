import { MagicLinkError } from "@namera-ai/schema";
import { matchesOriginPattern } from "@namera-ai/utils/trusted-origin";
import { Effect } from "effect";

import { AuthConfig } from "@/config";

export const originCheck = (urls: { url: URL; label?: string }[]) =>
  Effect.gen(function* () {
    const authConfig = yield* AuthConfig;

    const validateUrl = (url: URL, label: string) =>
      Effect.gen(function* () {
        {
          const isTrustedOrigin = authConfig.trustedOrigins.some((origin) =>
            matchesOriginPattern(url.toString(), origin, {
              allowRelativePaths: label !== "origin",
            }),
          );

          if (!isTrustedOrigin) {
            yield* Effect.fail(
              new MagicLinkError({
                code: "INVALID_ORIGIN",
                message: `The ${label} must be a trusted origin.`,
              }),
            );
          }
        }
      });

    for (const url of urls) {
      yield* validateUrl(url.url, url.label ?? "callbackUrl");
    }
  });
