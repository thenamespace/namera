import type {
  SigInMagicLinkBody,
  VerifyMagicLinkBody,
} from "@namera-ai/schema/dto";

import { Effect, Redacted } from "effect";

import { HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { createOrganization } from "@/common";
import { api } from "@namera-ai/api";
import { Auth, AuthConfig } from "@namera-ai/auth";
import { AdminDatabase, Transaction } from "@namera-ai/database";
import { mapToDatabaseError, mapToInternalError } from "@namera-ai/schema";

const signInMagicLinkHandler = (payload: SigInMagicLinkBody) =>
  Effect.gen(function* () {
    const db = yield* AdminDatabase.AdminDatabase;
    const auth = yield* Auth.Auth;

    const { url } = yield* db.transaction((tx) =>
      Effect.gen(function* () {
        return yield* auth.magicLink.signInMagicLink(payload);
      }).pipe(Transaction.withTx(tx)),
    );

    // TODO: Send Email
    yield* Effect.log(url.toString());
  }).pipe(mapToDatabaseError, mapToInternalError);

const magicLinkVerifyHandler = (payload: VerifyMagicLinkBody) =>
  Effect.gen(function* () {
    const auth = yield* Auth.Auth;
    const authConfig = yield* AuthConfig.AuthConfig;
    const db = yield* AdminDatabase.AdminDatabase;

    const res = yield* db.transaction((tx) =>
      Effect.gen(function* () {
        const result = yield* auth.magicLink.verifyMagicLink(payload);

        if (result.isNewUser) {
          // Create User Initial Organization
          yield* createOrganization({
            sessionId: result.session.id,
            userId: result.user.id,
            payload: {
              name: "Personal",
              metadata: {
                logo: {
                  type: "icon",
                  value: "building",
                },
              },
            },
          });
        }

        return result;
      }).pipe(Transaction.withTx(tx)),
    );

    return yield* HttpServerResponse.redirect(res.redirectUrl)
      .pipe(
        HttpServerResponse.setCookie(
          authConfig.session.cookieName,
          Redacted.value(res.token),
          {
            ...authConfig.session.cookieOpts,
            maxAge: authConfig.session.expiresIn,
          },
        ),
      )
      .pipe(Effect.orDie);
  }).pipe(mapToDatabaseError, mapToInternalError);

export const MagicLinkGroupLive = HttpApiBuilder.group(
  api,
  "magicLink",
  (handlers) =>
    handlers
      .handle("signIn", ({ payload }) => signInMagicLinkHandler(payload))
      .handle("verify", ({ query }) => magicLinkVerifyHandler(query)),
);
