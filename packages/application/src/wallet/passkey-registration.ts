import { DateTime, Duration, Effect, Schema } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import { Passkeys } from "@namera-ai/passkeys";
import {
  PasskeyRegistrationError,
  PasskeyVerificationError,
  type OrganizationId,
  type UserId,
  type VerificationId,
} from "@namera-ai/protocol";
import {
  type PasskeyRegistrationResponse,
  PasskeyRegistrationOptions,
  type PasskeyRegistrationOptionsResponse,
} from "@namera-ai/protocol/dto";
import { generateUniqueId } from "@namera-ai/utils";

import { AuthConfig } from "#/auth/config";

const registrationIdentifier = (organizationId: OrganizationId, userId: UserId) =>
  `${organizationId}:${userId}`;

export const makePasskeyRegistrationApplication = Effect.gen(function* () {
  const config = yield* AuthConfig;
  const passkeys = yield* Passkeys;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;

  return Effect.fn("application.wallet.createPasskeyRegistrationOptions")(
    (input: {
      readonly organizationId: OrganizationId;
      readonly userId: UserId;
      readonly userName: string;
      readonly userDisplayName: string;
    }) =>
      Effect.gen(function* () {
        const now = yield* DateTime.now;
        const expiresAt = DateTime.addDuration(now, config.passkey.timeToLive);
        const options = yield* passkeys
          .generateRegistrationOptions({
            rpName: config.passkey.relyingPartyName,
            rpId: config.dashboardPublicOrigin.hostname,
            // A repeated RP/user handle can replace an earlier wallet's resident credential.
            userId: generateUniqueId(),
            userName: input.userName,
            userDisplayName: input.userDisplayName,
            timeoutMs: Duration.toMillis(config.passkey.timeToLive),
          })
          .pipe(Effect.flatMap(Schema.decodeUnknownEffect(PasskeyRegistrationOptions)));
        const identifier = registrationIdentifier(input.organizationId, input.userId);

        const verification = yield* transaction.run(
          Effect.gen(function* () {
            yield* repository.auth.verification.revokePending({
              purpose: config.passkey.purpose,
              identifier,
              revokedAt: now,
            });
            return yield* repository.auth.verification.create({
              purpose: config.passkey.purpose,
              identifier,
              data: {
                version: 1,
                challenge: options.challenge,
                rpId: options.rp.id,
                origin: config.dashboardPublicOrigin.origin,
                organizationId: input.organizationId,
                userId: input.userId,
              },
              tokenHash: null,
              codeHmac: null,
              expiresAt,
            });
          }),
        );
        if (verification === undefined) {
          return yield* new PasskeyRegistrationError({
            code: "REGISTRATION_OPTIONS_UNAVAILABLE",
          });
        }

        return {
          verificationId: verification.id,
          options,
          expiresAt,
        } satisfies PasskeyRegistrationOptionsResponse;
      }).pipe(
        Effect.mapError(
          () => new PasskeyRegistrationError({ code: "REGISTRATION_OPTIONS_UNAVAILABLE" }),
        ),
      ),
  );
});

export const makeVerifyPasskeyRegistration = Effect.gen(function* () {
  const passkeys = yield* Passkeys;
  const repository = yield* Repository;

  return Effect.fn("application.wallet.verifyPasskeyRegistration")(function* (input: {
    readonly verificationId: VerificationId;
    readonly organizationId: OrganizationId;
    readonly userId: UserId;
    readonly response: PasskeyRegistrationResponse;
  }) {
    const verification = yield* repository.auth.verification
      .findById(input.verificationId)
      .pipe(Effect.catchTag("DatabaseError", Effect.die));
    if (
      verification === undefined ||
      verification.purpose !== "passkey-registration" ||
      verification.data.organizationId !== input.organizationId ||
      verification.data.userId !== input.userId ||
      verification.consumedAt !== null ||
      verification.revokedAt !== null
    ) {
      return yield* new PasskeyVerificationError({ code: "REGISTRATION_NOT_FOUND" });
    }

    const now = yield* DateTime.now;
    if (DateTime.toEpochMillis(verification.expiresAt) <= DateTime.toEpochMillis(now)) {
      return yield* new PasskeyVerificationError({ code: "REGISTRATION_EXPIRED" });
    }

    return yield* passkeys
      .verifyRegistration({
        response: input.response,
        expectedChallenge: verification.data.challenge,
        expectedOrigin: verification.data.origin,
        expectedRpId: verification.data.rpId,
      })
      .pipe(
        Effect.tapError(() =>
          repository.auth.verification
            .incrementAttempts({
              verificationId: input.verificationId,
              now,
              maxAttempts: 3,
            })
            .pipe(Effect.catchTag("DatabaseError", Effect.die)),
        ),
        Effect.mapError(() => new PasskeyVerificationError({ code: "REGISTRATION_INVALID" })),
      );
  });
});
