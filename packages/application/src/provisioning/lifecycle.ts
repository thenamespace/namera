import { Effect } from "effect";

import { CryptoService } from "@namera-ai/crypto";
import { Repository, type ProvisioningLease } from "@namera-ai/database";
import {
  CredentialId,
  SignerProvisioningId,
  SigningKeyId,
  SignerProvisioningError,
  type ActorId,
  type OrganizationId,
} from "@namera-ai/protocol";
import type { SignerProvisioning } from "@namera-ai/protocol/model";
import { generateUniqueId } from "@namera-ai/utils";

export type ProvisioningAttempt = {
  readonly record: SignerProvisioning;
  readonly lease: ProvisioningLease;
};

export const makeSignerProvisioning = Effect.gen(function* () {
  const repository = yield* Repository;
  const crypto = yield* CryptoService;
  const attempts = repository.core.signerProvisioning;

  return Effect.fn("application.provisioning.run")(
    function* <A, E, R>(input: {
      readonly organizationId: OrganizationId;
      readonly actorId: ActorId;
      readonly provider: string;
      readonly purpose: SignerProvisioning["purpose"];
      readonly idempotencyKey?: string;
      readonly request: unknown;
      readonly create: (attempt: ProvisioningAttempt) => Effect.Effect<A, E, R>;
      readonly completed: (resourceId: string) => Effect.Effect<A, E, R>;
    }) {
      // Requests are schema-encoded before hashing. Object ordering is not identity.
      const requestHash = yield* crypto.hash({
        purpose: "signer.provisioning.request",
        value: JSON.stringify(input.request, (_key, value) =>
          value !== null && typeof value === "object" && !Array.isArray(value)
            ? Object.fromEntries(Object.entries(value).toSorted(([a], [b]) => a.localeCompare(b)))
            : value,
        ),
      });
      const record = yield* attempts.reserve({
        id: SignerProvisioningId.make(generateUniqueId()),
        organizationId: input.organizationId,
        actorId: input.actorId,
        provider: input.provider,
        purpose: input.purpose,
        idempotencyKey: input.idempotencyKey ?? `legacy:${requestHash}`,
        requestHash,
        signingKeyId: SigningKeyId.make(generateUniqueId()),
        credentialId: CredentialId.make(generateUniqueId()),
      });
      if (record.requestHash !== requestHash)
        return yield* new SignerProvisioningError({ code: "REQUEST_CONFLICT" });
      if (record.status === "completed" && record.resourceId !== null)
        return yield* input.completed(record.resourceId);

      const lease = {
        id: record.id,
        organizationId: input.organizationId,
        leaseToken: yield* crypto.randomToken(),
      };
      const claimed = yield* attempts.claim(lease);
      if (!claimed) return yield* new SignerProvisioningError({ code: "RECOVERY_REQUIRED" });
      const heartbeat = Effect.gen(function* () {
        yield* Effect.sleep("20 seconds");
        if (!(yield* attempts.renew(lease)))
          return yield* new SignerProvisioningError({ code: "LEASE_LOST" });
      }).pipe(Effect.forever);
      return yield* input
        .create({ record: claimed, lease })
        .pipe(
          Effect.raceFirst(heartbeat),
          Effect.ensuring(attempts.release(lease).pipe(Effect.orDie)),
        );
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );
});
