import { AdminDatabaseLive, Database, withTx } from "@repo/database";
import { AuthRepo } from "@repo/domain/auth";
import type {
  Session,
  SigInMagicLinkBody,
  User,
  VerifyMagicLinkBody,
} from "@repo/schema";
import { base64Url } from "@repo/utils/base64";
import { createHash } from "@repo/utils/hash";
import { generateRandomString } from "@repo/utils/random";
import { Clock, Context, Data, Effect, Layer } from "effect";

import { AuthConfig } from "@/config";

class MagicLinkError extends Data.TaggedError("MagicLinkError")<{
  code:
    | "TOKEN_EXPIRED"
    | "SEND_EMAIL_FAILED"
    | "ATTEMPTS_EXCEEDED"
    | "TOKEN_NOT_FOUND";
  message?: string;
}> {}

export type MagicLinkShape = {
  signInMagicLink: (
    params: SigInMagicLinkBody,
  ) => Effect.Effect<void, MagicLinkError, AuthRepo>;
  verifyMagicLink: (params: VerifyMagicLinkBody) => Effect.Effect<
    {
      isNewUser: boolean;
      session: Session;
      user: User;
      token: string;
    },
    MagicLinkError,
    AuthRepo
  >;
};

export class MagicLink extends Context.Tag("MagicLink")<
  MagicLink,
  MagicLinkShape
>() {}

const signInMagicLink = (params: SigInMagicLinkBody) =>
  Effect.gen(function* () {
    const authRepo = yield* AuthRepo;
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
    yield* authRepo.verification.createVerification({
      expiresAt,
      identifier: hashed,
      value: JSON.stringify({
        attempt: 0,
        email: params.email,
        name: params.name,
      }),
    });

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
  }).pipe(Effect.provide(AdminDatabaseLive.pipe(Layer.orDie)));

const verifyMagicLink = (params: VerifyMagicLinkBody) =>
  Effect.gen(function* () {
    const db = yield* Database;
    const authRepo = yield* AuthRepo;

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

        let isNewUser = false;
        let user = yield* authRepo.user.findUserByEmail(email);

        if (!user) {
          user = yield* authRepo.user.createUser({
            email: email,
            emailVerified: true,
            id: undefined,
            name: name ?? "User",
          });
          isNewUser = true;
        }

        if (!user.emailVerified) {
          yield* authRepo.user.updateUser(user.id, {
            emailVerified: true,
          });
        }

        // 7 days
        const expiresAt = new Date(
          (yield* Clock.currentTimeMillis) + 7 * 24 * 60 * 60 * 1000,
        );
        const token = generateRandomString(32, "A-Z", "a-z", "0-9");

        const session = yield* authRepo.session.createSession({
          expiresAt,
          token,
          userId: user.id,
          // TODO: Pass IP and User Agent from params/headers
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
  }).pipe(Effect.provide(AdminDatabaseLive.pipe(Layer.orDie)), Effect.orDie);

export const MagicLinkLive = Layer.effect(
  MagicLink,
  Effect.gen(function* () {
    return MagicLink.of({
      signInMagicLink: (params) => signInMagicLink(params),
      verifyMagicLink: (params) => verifyMagicLink(params),
    });
  }),
);
