import { Database } from "@repo/database";
import {
  type SigInMagicLinkBody,
  type VerifyMagicLinkBody,
  verification,
} from "@repo/schema";
import { base64Url } from "@repo/utils/base64";
import { createHash } from "@repo/utils/hash";
import { generateRandomString } from "@repo/utils/random";
import { Clock, Context, Data, Effect, Layer } from "effect";

import { AuthConfig } from "@/config";

class MagicLinkCreationFailed extends Data.TaggedError(
  "MagicLinkCreationFailed",
) {}

class TokenNotFound extends Data.TaggedError("TokenNotFound") {}
class TokenExpired extends Data.TaggedError("TokenExpired") {}

export type MagicLinkShape = {
  signInMagicLink: (
    params: SigInMagicLinkBody,
  ) => Effect.Effect<void, MagicLinkCreationFailed, Database>;
  verifyMagicLink: (
    params: VerifyMagicLinkBody,
  ) => Effect.Effect<void, TokenNotFound | TokenExpired, Database>;
};

export class MagicLink extends Context.Tag("MagicLink")<
  MagicLink,
  MagicLinkShape
>() {}

const signInMagicLink = (params: SigInMagicLinkBody) =>
  Effect.gen(function* () {
    const db = yield* Database;
    const config = yield* AuthConfig.pipe(Effect.orDie);

    const verificationToken = generateRandomString(32, "A-Z", "a-z");
    const hash = yield* Effect.promise(() =>
      createHash("SHA-256").digest(new TextEncoder().encode(verificationToken)),
    );
    const hashed = base64Url.encode(new Uint8Array(hash), {
      padding: false,
    });

    // 15 minutes
    const expiresAt = new Date(
      (yield* Clock.currentTimeMillis) + 15 * 60 * 1000,
    );

    // Store Verification Token
    yield* db
      .insert(verification)
      .values({
        expiresAt,
        identifier: hashed,
        value: JSON.stringify({
          attempt: 0,
          email: params.email,
          name: params.name,
        }),
      })
      .pipe(
        Effect.catchTag("EffectDrizzleQueryError", () =>
          Effect.fail(new MagicLinkCreationFailed()),
        ),
      );

    const url = new URL("/magic-link/verify", config.baseUrl);
    url.searchParams.set("token", verificationToken);
    url.searchParams.set("callbackUrl", params.callbackUrl.toString() ?? "/");
    url.searchParams.set(
      "newUserCallbackUrl",
      params.newUserCallbackUrl.toString() ?? "/",
    );
    url.searchParams.set(
      "errorCallbackUrl",
      params.errorCallbackUrl.toString() ?? "/",
    );

    // TODO: Send Email
    yield* Effect.log("Magic Link: ", url.toString());
  });

const verifyMagicLink = (params: VerifyMagicLinkBody) =>
  Effect.gen(function* () {
    const db = yield* Database;

    const hash = yield* Effect.promise(() =>
      createHash("SHA-256").digest(new TextEncoder().encode(params.token)),
    );
    const hashed = base64Url.encode(new Uint8Array(hash), {
      padding: false,
    });

    // Find Verification Token
    const verification = yield* db.query.verification
      .findFirst({
        where: {
          identifier: {
            eq: hashed,
          },
        },
      })
      .pipe(
        Effect.catchTag("EffectDrizzleQueryError", () =>
          Effect.fail(new TokenNotFound()),
        ),
      );

    if (!verification) {
      return yield* Effect.fail(new TokenNotFound());
    }

    if (verification.expiresAt < new Date()) {
      return yield* Effect.fail(new TokenExpired());
    }
  });

export const MagicLinkLive = Layer.effect(
  MagicLink,
  Effect.gen(function* () {
    return MagicLink.of({
      signInMagicLink: (params) => signInMagicLink(params),
      verifyMagicLink: (params) => verifyMagicLink(params),
    });
  }),
);
