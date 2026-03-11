import { AdminDatabase, type Database, withTx } from "@namera-ai/database";
import { AuthRepo } from "@namera-ai/domain/auth";
import {
  MagicLinkError,
  type SigInMagicLinkBody,
  type VerifyMagicLinkBody,
  type VerifyMagicLinkResponse,
} from "@namera-ai/schema";
import { base64Url } from "@namera-ai/utils/base64";
import { createHash } from "@namera-ai/utils/hash";
import { generateRandomString } from "@namera-ai/utils/random";
import { Clock, Context, Duration, Effect, Layer } from "effect";

import { AuthConfig } from "@/config";
import { originCheck } from "@/helpers/origin";

export type MagicLinkShape = {
  signInMagicLink: (
    params: SigInMagicLinkBody,
  ) => Effect.Effect<void, MagicLinkError, AuthRepo | Database | AuthConfig>;
  verifyMagicLink: (
    params: VerifyMagicLinkBody,
  ) => Effect.Effect<
    VerifyMagicLinkResponse,
    MagicLinkError,
    AuthRepo | AdminDatabase | Database | AuthConfig
  >;
};

export class MagicLink extends Context.Tag("MagicLink")<
  MagicLink,
  MagicLinkShape
>() {}

const signInMagicLink = (params: SigInMagicLinkBody) =>
  Effect.gen(function* () {
    const authRepo = yield* AuthRepo;
    const config = yield* AuthConfig;

    yield* originCheck([
      { label: "callbackUrl", url: params.callbackUrl },
      { label: "newUserCallbackUrl", url: params.newUserCallbackUrl },
      { label: "errorCallbackUrl", url: params.errorCallbackUrl },
    ]);

    const verificationToken = generateRandomString(32, "A-Z", "a-z");
    const hash = yield* Effect.promise(() =>
      createHash("SHA-256").digest(new TextEncoder().encode(verificationToken)),
    );
    const hashed = base64Url.encode(new Uint8Array(hash), {
      padding: false,
    });

    const expiresAt = new Date(
      (yield* Clock.currentTimeMillis) +
        Duration.toMillis(config.emailVerification.expiresIn),
    );

    // Store Verification Token
    yield* authRepo.verification.createVerification({
      expiresAt,
      identifier: hashed,
      value: JSON.stringify({
        attempt: 0,
        email: params.email,
        name: params.name,
      }),
    });

    const url = new URL("/auth/magic-link/verify", config.baseURL);
    url.searchParams.set("token", verificationToken);
    url.searchParams.set("callbackUrl", params.callbackUrl.toString());
    url.searchParams.set(
      "newUserCallbackUrl",
      params.newUserCallbackUrl.toString(),
    );
    url.searchParams.set(
      "errorCallbackUrl",
      params.errorCallbackUrl.toString(),
    );

    // TODO: Send Email
    yield* Effect.log("Magic Link: ", url.toString());
  });

const verifyMagicLink = (params: VerifyMagicLinkBody) =>
  Effect.gen(function* () {
    const db = yield* AdminDatabase;
    const authRepo = yield* AuthRepo;
    const config = yield* AuthConfig;

    const hash = yield* Effect.promise(() =>
      createHash("SHA-256").digest(new TextEncoder().encode(params.token)),
    );
    const hashed = base64Url.encode(new Uint8Array(hash), {
      padding: false,
    });

    // Start Transaction
    const res = yield* db.transaction((tx) =>
      Effect.gen(function* () {
        // Find Verification Token
        const verificationValue = yield* authRepo.verification.findVerification(
          {
            identifier: hashed,
          },
        );

        if (!verificationValue) {
          return yield* Effect.fail(
            new MagicLinkError({ code: "TOKEN_NOT_FOUND" }),
          );
        }

        if (verificationValue.expiresAt < new Date()) {
          return yield* Effect.fail(
            new MagicLinkError({ code: "TOKEN_EXPIRED" }),
          );
        }

        const {
          email,
          name,
          attempt = 0,
        } = JSON.parse(verificationValue.value) as {
          email: string;
          name?: string | undefined;
          attempt?: number | undefined;
        };

        // If attempts exceeded, delete the token and fail
        if (attempt >= 5) {
          yield* authRepo.verification.deleteVerification({
            identifier: verificationValue.identifier,
          });
          return yield* Effect.fail(
            new MagicLinkError({ code: "ATTEMPTS_EXCEEDED" }),
          );
        }

        // Update Attempt Count
        yield* authRepo.verification.updateVerification(
          verificationValue.identifier,
          {
            value: JSON.stringify({
              attempt: attempt + 1,
              email,
              name,
            }),
          },
        );

        let isNewUser = false;
        let user = yield* authRepo.user.findUserByEmail(email);

        // Create User if not found
        if (!user) {
          user = yield* authRepo.user.createUser({
            email: email,
            emailVerified: true,
            id: undefined,
            name: name ?? "User",
          });
          isNewUser = true;
        }

        // Update Email Verified
        if (!user.emailVerified) {
          yield* authRepo.user.updateUser(user.id, {
            emailVerified: true,
          });
        }

        const sessionExpiredAt = new Date(
          (yield* Clock.currentTimeMillis) +
            Duration.toMillis(config.session.expiresIn),
        );
        const token = generateRandomString(32, "A-Z", "a-z", "0-9");

        const session = yield* authRepo.session.createSession({
          expiresAt: sessionExpiredAt,
          token,
          userId: user.id,
          // TODO: Pass IP and User Agent from params/headers
        });

        yield* authRepo.verification.deleteVerification({
          identifier: verificationValue.identifier,
        });

        return {
          isNewUser,
          session,
          token,
          user,
        };
      }).pipe(withTx(tx)),
    );

    return res;
  }).pipe(Effect.orDie);

export const MagicLinkLive = Layer.effect(
  MagicLink,
  Effect.gen(function* () {
    return MagicLink.of({
      signInMagicLink: (params) => signInMagicLink(params),
      verifyMagicLink: (params) => verifyMagicLink(params),
    });
  }),
);
