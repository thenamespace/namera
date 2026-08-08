import { DateTime, Effect, Metric } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import { MagicLinkError } from "@namera-ai/protocol";
import type { VerifyMagicLinkRequest } from "@namera-ai/protocol/dto";
import { magicLinkVerificationResults } from "@namera-ai/telemetry";

import { AuthConfig } from "#/auth/config";
import {
  createOrganizationWithOwner,
  createUserWithPersonalOrganization,
} from "#/auth/organization/helpers";
import { cryptoPurpose } from "#/crypto/data";
import { CryptoService } from "#/crypto/layer";

export interface VerifyMagicLinkResult {
  readonly sessionToken: string;
  readonly returnTo: string;
}

export interface VerifyMagicLinkApplication {
  readonly verify: (
    input: VerifyMagicLinkRequest,
  ) => Effect.Effect<VerifyMagicLinkResult, MagicLinkError>;
}

export const makeVerifyMagicLinkApplication = Effect.gen(function* () {
  const config = yield* AuthConfig;
  const crypto = yield* CryptoService;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;

  const verify = Effect.fn("Application.magicLink.verify")(
    function* (input: VerifyMagicLinkRequest) {
      const now = yield* DateTime.now;
      const verification =
        input.type === "token"
          ? yield* repository.auth.verification.findById(input.id)
          : yield* repository.auth.verification.findPendingByIdentifier({
              purpose: config.magicLink.purpose,
              identifier: input.email,
              now,
              maxAttempts: config.magicLink.maximumAttempts,
            });

      if (
        !verification ||
        verification.purpose !== config.magicLink.purpose ||
        verification.consumedAt !== null ||
        verification.revokedAt !== null ||
        DateTime.toEpochMillis(verification.expiresAt) <= DateTime.toEpochMillis(now)
      ) {
        yield* Metric.update(magicLinkVerificationResults, "invalid");
        return yield* new MagicLinkError({ code: "INVALID_OR_EXPIRED_LINK" });
      }

      const matches =
        input.type === "token"
          ? (yield* crypto.hash({
              purpose: cryptoPurpose.magicLinkToken,
              value: input.token,
            })) === verification.tokenHash
          : yield* crypto.verifyHmac({
              purpose: cryptoPurpose.magicLinkCode,
              value: input.code,
              expected: verification.codeHmac,
            });
      if (!matches) {
        if (input.type === "code") {
          const attempted = yield* repository.auth.verification.incrementAttempts({
            verificationId: verification.id,
            now,
            maxAttempts: config.magicLink.maximumAttempts,
          });
          if (attempted && attempted.attempts >= config.magicLink.maximumAttempts) {
            yield* Metric.update(magicLinkVerificationResults, "attempts_exceeded");
            return yield* new MagicLinkError({ code: "TOO_MANY_ATTEMPTS" });
          }
        }
        yield* Metric.update(magicLinkVerificationResults, "invalid");
        return yield* new MagicLinkError({ code: "INVALID_OR_EXPIRED_LINK" });
      }

      const sessionToken = yield* crypto.randomToken(config.session.tokenBytes);
      const sessionTokenHash = yield* crypto.hash({
        purpose: cryptoPurpose.sessionToken,
        value: sessionToken,
      });
      yield* transaction.run(
        Effect.gen(function* () {
          const consumed = yield* repository.auth.verification.consume({
            verificationId: verification.id,
            consumedAt: now,
            maxAttempts: config.magicLink.maximumAttempts,
          });
          if (!consumed) {
            return yield* new MagicLinkError({ code: "INVALID_OR_EXPIRED_LINK" });
          }

          const existingUser = yield* repository.auth.user.findByEmail(verification.identifier);
          const initialized = existingUser
            ? { user: existingUser, organization: undefined }
            : yield* createUserWithPersonalOrganization(repository, verification.identifier).pipe(
                Effect.catchTag("OrganizationError", Effect.die),
              );
          const user = initialized.user;
          yield* repository.auth.user.markEmailVerifiedAndLogin(user.id, now);
          const memberships = yield* repository.auth.member.findMembershipsForUser(user.id);
          const organization =
            initialized.organization ??
            memberships[0]?.organization ??
            (yield* createOrganizationWithOwner(repository, user.id, "Personal").pipe(
              Effect.catchTag("OrganizationError", Effect.die),
            ));
          yield* repository.auth.session.create({
            userId: user.id,
            tokenHash: sessionTokenHash,
            activeOrganizationId: organization.id,
            expiresAt: DateTime.addDuration(now, config.session.timeToLive),
          });
        }),
      );

      yield* Metric.update(magicLinkVerificationResults, "success");
      yield* Effect.logInfo("magic_link.verified", { method: input.type });
      return {
        sessionToken,
        returnTo: verification.data.returnTo ?? config.returnTo.defaultPath,
      };
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  return { verify } satisfies VerifyMagicLinkApplication;
});
