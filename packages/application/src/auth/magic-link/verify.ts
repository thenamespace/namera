import { DateTime, Effect, Metric } from "effect";

import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository, TransactionService } from "@namera-ai/database";
import {
  InvalidMagicLinkError,
  MagicLinkAttemptsExceededError,
  type MagicLinkError,
} from "@namera-ai/protocol";
import type { VerifyMagicLinkRequest } from "@namera-ai/protocol/dto";
import { magicLinkVerificationResults } from "@namera-ai/telemetry";

import { Audit } from "#/audit/layer";
import { AuthConfig } from "#/auth/config";
import {
  createOrganizationWithOwner,
  createUserWithPersonalOrganization,
} from "#/auth/organization/helpers";
import { makeCreateNotification } from "#/notification/create";
import { notificationPolicy } from "#/notification/data";

export interface VerifyMagicLinkResult {
  readonly sessionToken: string;
  readonly returnTo: string;
}

export interface VerifyMagicLinkContext {
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

export interface VerifyMagicLinkApplication {
  readonly verify: (
    input: VerifyMagicLinkRequest,
    context: VerifyMagicLinkContext,
  ) => Effect.Effect<VerifyMagicLinkResult, MagicLinkError>;
}

export const makeVerifyMagicLinkApplication = Effect.gen(function* () {
  const config = yield* AuthConfig;
  const audit = yield* Audit;
  const crypto = yield* CryptoService;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const createNotification = yield* makeCreateNotification;

  const verify = Effect.fn("application.magicLink.verify")(
    function* (input: VerifyMagicLinkRequest, context: VerifyMagicLinkContext) {
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
        yield* Metric.update(
          magicLinkVerificationResults,
          verification &&
            DateTime.toEpochMillis(verification.expiresAt) <= DateTime.toEpochMillis(now)
            ? "expired"
            : "invalid",
        );
        return yield* new InvalidMagicLinkError({ code: "INVALID_OR_EXPIRED_LINK" });
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
            return yield* new MagicLinkAttemptsExceededError({ code: "TOO_MANY_ATTEMPTS" });
          }
        }
        yield* Metric.update(magicLinkVerificationResults, "invalid");
        return yield* new InvalidMagicLinkError({ code: "INVALID_OR_EXPIRED_LINK" });
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
            return yield* new InvalidMagicLinkError({ code: "INVALID_OR_EXPIRED_LINK" });
          }

          const existingUser = yield* repository.auth.user.findByEmail(verification.identifier);
          const initialized = existingUser
            ? { user: existingUser, organization: undefined }
            : yield* createUserWithPersonalOrganization(repository, audit, verification.identifier);
          const user = initialized.user;
          yield* repository.auth.user.markEmailVerifiedAndLogin(user.id, now);
          const memberships = yield* repository.auth.member.findMembershipsForUser(user.id);
          const organization =
            initialized.organization ??
            memberships[0]?.organization ??
            (yield* createOrganizationWithOwner(repository, audit, user.id, "Personal"));
          const session = yield* repository.auth.session.create({
            userId: user.id,
            tokenHash: sessionTokenHash,
            activeOrganizationId: organization.id,
            ...(context.ipAddress === null ? {} : { ipAddress: context.ipAddress }),
            ...(context.userAgent === null ? {} : { userAgent: context.userAgent }),
            expiresAt: DateTime.addDuration(now, config.session.timeToLive),
          });
          const signedInEvent = yield* audit.user({
            userId: user.id,
            sessionId: session.id,
            event: "user.signed_in",
            data: {
              version: 1,
              method: "magic-link",
              ipAddress: session.ipAddress,
              userAgent: session.userAgent,
            },
          });
          yield* createNotification({
            organizationId: null,
            actorId: null,
            type: "auth.new-sign-in",
            resourceType: "session",
            resourceId: session.id,
            data: {
              version: 1,
              ipAddress: context.ipAddress,
              userAgent: context.userAgent,
            },
            idempotencyKey: `notification:auth.new-sign-in:${session.id}`,
            correlationId: signedInEvent.correlationId,
            expiresAt: null,
            recipients: [
              {
                userId: user.id,
                email: {
                  type: "new-sign-in",
                  to: user.email,
                  variables: {
                    signedInAt: DateTime.formatIso(now),
                    ipAddress: context.ipAddress ?? "Unknown",
                    userAgent: context.userAgent ?? "Unknown",
                  },
                  expiresAt: DateTime.addDuration(
                    now,
                    notificationPolicy["auth.new-sign-in"].emailTimeToLive,
                  ),
                },
              },
            ],
          });
        }),
      );

      yield* Metric.update(magicLinkVerificationResults, "success");
      yield* Effect.logInfo("magic_link.verified").pipe(
        Effect.annotateLogs({ method: input.type }),
      );
      return {
        sessionToken,
        returnTo: verification.data.returnTo ?? config.returnTo.defaultPath,
      };
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  return { verify } satisfies VerifyMagicLinkApplication;
});
