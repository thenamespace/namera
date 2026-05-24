import type { HttpServerRequest } from "effect/unstable/http";

import { Effect, Layer, Context, DateTime, Metric } from "effect";

import { createNewUser, getHttpRequestMetadata } from "@/helpers";
import { originCheck } from "@/helpers/origin";
import { type Database } from "@namera-ai/database";
import * as AuthRepo from "@namera-ai/domain/auth";
import * as CoreRepo from "@namera-ai/domain/core";
import {
  DatabaseError,
  Email,
  MagicLinkError,
  type SigInMagicLinkBody,
  type VerifyMagicLinkBody,
  type VerifyMagicLinkResponse,
} from "@namera-ai/schema";
import { userCountMetric } from "@namera-ai/telemetry/metrics";
import { base64Url } from "@namera-ai/utils/base64";
import { inferNameFromEmail } from "@namera-ai/utils/email";
import { createHash } from "@namera-ai/utils/hash";
import { generateRandomString } from "@namera-ai/utils/random";

import * as AuthConfig from "../config";

export type MagicLink = {
  signInMagicLink: (
    params: SigInMagicLinkBody,
  ) => Effect.Effect<
    void,
    MagicLinkError | DatabaseError,
    AuthRepo.AuthRepo | Database.Database | AuthConfig.AuthConfig
  >;
  verifyMagicLink: (
    params: VerifyMagicLinkBody,
  ) => Effect.Effect<
    VerifyMagicLinkResponse,
    MagicLinkError,
    | HttpServerRequest.HttpServerRequest
    | CoreRepo.CoreRepo
    | AuthRepo.AuthRepo
    | Database.Database
    | AuthConfig.AuthConfig
  >;
};

export const MagicLink = Context.Service<MagicLink>("MagicLink");

const signInMagicLink = (params: SigInMagicLinkBody) =>
  Effect.gen(function* () {
    const authRepo = yield* AuthRepo.AuthRepo;
    const config = yield* AuthConfig.AuthConfig;

    // Check urls origin, to prevent CSRF
    yield* originCheck([
      { label: "callbackUrl", url: params.callbackUrl },
      { label: "newUserCallbackUrl", url: params.newUserCallbackUrl },
    ]);

    // Generate and store verification token
    const verificationToken = generateRandomString(32, "A-Z", "a-z");
    const hash = yield* Effect.promise(() =>
      createHash("SHA-256").digest(new TextEncoder().encode(verificationToken)),
    );
    const hashed = base64Url.encode(new Uint8Array(hash), {
      padding: false,
    });

    const expiresAt = (yield* DateTime.now).pipe(
      DateTime.addDuration(config.emailVerification.expiresIn),
      DateTime.toDate,
    );

    // Store Verification Token in DB
    yield* authRepo.verification.createVerification({
      expiresAt,
      identifier: hashed,
      value: JSON.stringify({
        attempt: 0,
        email: params.email,
        callbackUrl: params.callbackUrl.toString(),
        newUserCallbackUrl: params.newUserCallbackUrl.toString(),
      }),
    });

    const url = new URL("/auth/magic-link/verify", config.baseURL);
    url.searchParams.set("token", verificationToken);

    // TODO: Send Email
    yield* Effect.log("Magic Link: ", url.toString());
  });

const verifyMagicLink = (params: VerifyMagicLinkBody) =>
  Effect.gen(function* () {
    const authRepo = yield* AuthRepo.AuthRepo;
    const config = yield* AuthConfig.AuthConfig;

    const requestMetadata = yield* getHttpRequestMetadata;

    // TODO: Move this to a hashing service if we have more use cases for hashing in the future
    const hash = yield* Effect.promise(() =>
      createHash("SHA-256").digest(new TextEncoder().encode(params.token)),
    );

    // TODO: Move this to a encoding service if we have more use cases for encoding in the future
    const hashed = base64Url.encode(new Uint8Array(hash), {
      padding: false,
    });

    const verificationValue = yield* authRepo.verification.findVerification({
      identifier: hashed,
    });

    if (!verificationValue) {
      return yield* Effect.fail(
        new MagicLinkError({ code: "TOKEN_NOT_FOUND" }),
      );
    }

    const now = (yield* DateTime.now).pipe(DateTime.toDate);

    if (verificationValue.expiresAt < now) {
      return yield* Effect.fail(new MagicLinkError({ code: "TOKEN_EXPIRED" }));
    }

    const {
      email,
      attempt = 0,
      callbackUrl,
      newUserCallbackUrl,
    } = JSON.parse(verificationValue.value) as {
      email: string;
      attempt?: number | undefined;
      callbackUrl: string;
      newUserCallbackUrl: string;
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
    yield* authRepo.verification.updateVerification(verificationValue.id, {
      value: JSON.stringify({
        attempt: attempt + 1,
        email,
        callbackUrl,
        newUserCallbackUrl,
      }),
    });

    let isNewUser = false;
    let user = yield* authRepo.user.findUserByEmail(email);

    // Create User if not found
    if (!user) {
      user = yield* createNewUser({
        email: Email.make(email),
        name: inferNameFromEmail(email),
        emailVerified: true,
        image: `https://api.dicebear.com/9.x/glass/svg?seed=${email}`,
      });
      isNewUser = true;
    }

    // Update Email Verified
    if (!user.emailVerified) {
      yield* authRepo.user.updateUser(user.id, {
        emailVerified: true,
      });
    }

    const sessionExpiresAt = (yield* DateTime.now).pipe(
      DateTime.addDuration(config.session.expiresIn),
      DateTime.toDate,
    );
    const token = generateRandomString(32, "A-Z", "a-z", "0-9");

    // Check and set a active organization if user is part of any organization
    const orgsForUser = yield* authRepo.organization.list(user.id);
    const activeOrganizationId = orgsForUser[0]?.organization?.id ?? null;

    const session = yield* authRepo.session.createSession({
      expiresAt: sessionExpiresAt,
      token,
      userId: user.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      activeOrganizationId,
    });

    yield* Effect.log("Session Created: ", session);

    yield* authRepo.verification.deleteVerification({
      identifier: verificationValue.identifier,
    });

    if (isNewUser) {
      // Update user count metric
      yield* Metric.update(userCountMetric, 1n);
    }

    const redirectUrl = isNewUser ? newUserCallbackUrl : callbackUrl;

    const res = {
      isNewUser,
      session,
      token,
      user,
      redirectUrl: new URL(redirectUrl),
    };

    return res;
  }).pipe(Effect.orDie);

export const layer = Layer.succeed(
  MagicLink,
  MagicLink.of({
    signInMagicLink: (params) => signInMagicLink(params),
    verifyMagicLink: (params) => verifyMagicLink(params),
  }),
);
