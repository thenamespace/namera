import { expect, layer } from "@effect/vitest";
import { DateTime, Effect, Layer, Schema } from "effect";

import { TransactionHash, UserOperationHash } from "@namera-ai/protocol";
import type { SessionKeyInstallationInsert } from "@namera-ai/protocol/model";

import { Repository, TestDatabase } from "../../src/index.js";
import { installationFixture as fixture } from "../fixtures/session-installation.js";

const Persistence = Repository.layer.pipe(Layer.provideMerge(TestDatabase.layer));
const hash = Schema.decodeSync(UserOperationHash)(`0x${"11".repeat(32)}`);
const otherHash = Schema.decodeSync(UserOperationHash)(`0x${"22".repeat(32)}`);
const transactionHash = Schema.decodeSync(TransactionHash)(`0x${"33".repeat(32)}`);

layer(Persistence)("session installation persistence", (it) => {
  it.effect("requires matching receipts, preserves terminal revocation and isolates tenants", () =>
    Effect.gen(function* () {
      yield* (yield* TestDatabase).reset;
      const repository = (yield* Repository).core.sessionKeyInstallation;
      const sessions = (yield* Repository).core.sessionKey;
      const owner = yield* fixture("installation-owner");
      const other = yield* fixture("installation-other");
      const installed = yield* repository.insert(owner.input);
      expect(
        (yield* sessions.findById(owner.input.sessionKeyId, owner.organization.id))?.status,
      ).toBe("pending");
      expect(
        yield* sessions.activate(owner.input.sessionKeyId, owner.organization.id),
      ).toBeUndefined();
      const scope = { id: installed.id, organizationId: owner.organization.id };
      const confirmation = {
        ...scope,
        userOperationHash: hash,
        transactionHash,
        confirmedAt: yield* DateTime.now,
      };
      expect(
        yield* repository.findById({ ...scope, organizationId: other.organization.id }),
      ).toBeUndefined();
      expect(yield* repository.markInstalled(confirmation)).toBeUndefined();
      expect((yield* repository.markSubmitted({ ...scope, userOperationHash: hash }))?.status).toBe(
        "submitted",
      );
      expect(
        yield* repository.markSubmitted({ ...scope, userOperationHash: otherHash }),
      ).toBeUndefined();
      expect(
        yield* repository.markInstalled({ ...confirmation, userOperationHash: otherHash }),
      ).toBeUndefined();
      expect((yield* repository.markInstalled(confirmation))?.status).toBe("installed");
      expect(
        yield* sessions.activate(owner.input.sessionKeyId, other.organization.id),
      ).toBeUndefined();
      expect(
        (yield* sessions.activate(owner.input.sessionKeyId, owner.organization.id))?.status,
      ).toBe("active");
      expect(
        yield* sessions.activate(owner.input.sessionKeyId, owner.organization.id),
      ).toBeUndefined();
      expect(
        yield* sessions.beginRevocation(
          owner.input.sessionKeyId,
          other.organization.id,
          other.actor.id,
          confirmation.confirmedAt,
        ),
      ).toBeUndefined();
      expect(
        (yield* sessions.beginRevocation(
          owner.input.sessionKeyId,
          owner.organization.id,
          owner.actor.id,
          confirmation.confirmedAt,
        ))?.status,
      ).toBe("revoking");
      expect(
        yield* sessions.finishRevocation(owner.input.sessionKeyId, owner.organization.id),
      ).toBeUndefined();
      expect((yield* repository.beginRevocation(scope))?.status).toBe("revoking");
      expect(yield* repository.markRevoked(confirmation)).toBeUndefined();
      yield* repository.markRevocationSubmitted({ ...scope, userOperationHash: otherHash });
      expect(
        (yield* repository.markRevoked({ ...confirmation, userOperationHash: otherHash }))?.status,
      ).toBe("revoked");
      expect(yield* repository.markInstalled(confirmation)).toBeUndefined();
      expect(yield* repository.beginRevocation(scope)).toBeUndefined();
      expect(
        yield* sessions.finishRevocation(owner.input.sessionKeyId, other.organization.id),
      ).toBeUndefined();
      expect(
        (yield* sessions.finishRevocation(owner.input.sessionKeyId, owner.organization.id))?.status,
      ).toBe("revoked");
      expect(
        yield* sessions.finishRevocation(owner.input.sessionKeyId, owner.organization.id),
      ).toBeUndefined();
    }),
  );

  it.effect(
    "enforces tenant/wallet ownership, entity binding, unique chains and receipt requirements in PostgreSQL",
    () =>
      Effect.gen(function* () {
        yield* (yield* TestDatabase).reset;
        const repository = (yield* Repository).core.sessionKeyInstallation;
        const owner = yield* fixture("installation-constraints");
        const other = yield* fixture("installation-cross-tenant");
        const reject = (input: SessionKeyInstallationInsert) =>
          repository.insert(input).pipe(
            Effect.as(false),
            Effect.catchTag("DatabaseError", () => Effect.succeed(true)),
          );
        expect(yield* reject({ ...owner.input, organizationId: other.organization.id })).toBe(true);
        expect(yield* reject({ ...owner.input, walletId: other.wallet.id })).toBe(true);
        expect(yield* reject({ ...owner.input, entityId: 2 })).toBe(true);
        expect(yield* reject({ ...owner.input, status: "installed" })).toBe(true);
        yield* repository.insert(owner.input);
        expect(yield* reject(owner.input)).toBe(true);
        expect(
          yield* repository.findForSession(owner.organization.id, owner.input.sessionKeyId),
        ).toHaveLength(1);
      }),
  );
});
