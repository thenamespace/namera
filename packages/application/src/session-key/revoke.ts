import { DateTime, Effect, Metric } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import {
  SessionKeyNotFoundError,
  type ActorId,
  type OrganizationId,
  type SessionKeyId,
} from "@namera-ai/protocol";
import { sessionKeyRevocationDuration, sessionKeyRevocationResults } from "@namera-ai/telemetry";

import { Audit } from "#/audit/layer";
import { makeCreateNotification } from "#/notification/create";
import { notificationPolicy } from "#/notification/data";

import { makeLoadSessionKeyViews } from "./view.js";

export const makeRevokeSessionKey = Effect.gen(function* () {
  const audit = yield* Audit;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const createNotification = yield* makeCreateNotification;
  const loadViews = yield* makeLoadSessionKeyViews;

  return Effect.fn("application.sessionKey.revoke")(
    function* (input: {
      readonly organizationId: OrganizationId;
      readonly actorId: ActorId;
      readonly sessionKeyId: SessionKeyId;
    }) {
      const now = yield* DateTime.now;
      const result = yield* transaction.run(
        Effect.gen(function* () {
          const revoked = yield* repository.core.sessionKey.revoke(
            input.sessionKeyId,
            input.organizationId,
            input.actorId,
            now,
          );
          if (revoked === undefined) {
            const existing = yield* repository.core.sessionKey.findById(
              input.sessionKeyId,
              input.organizationId,
            );
            if (existing === undefined) {
              return yield* new SessionKeyNotFoundError({ code: "SESSION_KEY_NOT_FOUND" });
            }
            return { sessionKey: existing, result: "already_revoked" as const };
          }

          const revokedGrants = yield* repository.core.sessionKeyGrant.revokeActiveForSessionKey(
            input.organizationId,
            revoked.id,
            input.actorId,
            now,
          );
          const event = yield* audit.organization({
            organizationId: input.organizationId,
            actorId: input.actorId,
            event: "session_key.revoked",
            resourceType: "session-key",
            resourceId: revoked.id,
            data: {
              version: 1,
              walletId: revoked.walletId,
              namespace: revoked.namespace,
              revokedGrantCount: revokedGrants.length,
            },
          });
          const organization = yield* repository.auth.organization.findById(input.organizationId);
          const wallet = yield* repository.core.wallet.findById(
            revoked.walletId,
            input.organizationId,
          );
          if (organization === undefined || wallet === undefined) {
            return yield* Effect.die("Session-key relations disappeared during revocation");
          }
          const members = yield* repository.auth.member.findOrganizationMembersForOrg(
            input.organizationId,
          );
          yield* createNotification({
            organizationId: input.organizationId,
            actorId: input.actorId,
            type: "session_key.revoked",
            resourceType: "session-key",
            resourceId: revoked.id,
            data: {
              version: 1,
              walletId: revoked.walletId,
              namespace: revoked.namespace,
              revokedGrantCount: revokedGrants.length,
            },
            idempotencyKey: `notification:session_key.revoked:${revoked.id}`,
            correlationId: event.correlationId,
            expiresAt: null,
            recipients: members
              .filter(({ organizationRole }) =>
                organizationRole.permissions.includes("session-key:read"),
              )
              .map(({ user }) => ({
                userId: user.id,
                email: {
                  type: "session-key-revoked" as const,
                  to: user.email,
                  expiresAt: DateTime.addDuration(
                    now,
                    notificationPolicy["session_key.revoked"].emailTimeToLive,
                  ),
                  variables: {
                    sessionKeyName: revoked.metadata.name,
                    walletName: wallet.wallet.metadata.name,
                    organizationName: organization.metadata.name,
                    revokedGrantCount: revokedGrants.length,
                  },
                },
              })),
          });
          return { sessionKey: revoked, result: "success" as const };
        }),
      );

      yield* Metric.update(
        Metric.withAttributes(sessionKeyRevocationResults, { result: result.result }),
        1,
      );
      if (result.result === "success") {
        yield* Effect.logInfo("session_key.revoked").pipe(
          Effect.annotateLogs({ namespace: result.sessionKey.namespace }),
        );
      }
      const [view] = yield* loadViews(input.organizationId, [result.sessionKey]);
      if (view === undefined) return yield* Effect.die("Revoked session key could not be loaded");
      return view;
    },
    Effect.trackDuration(sessionKeyRevocationDuration),
    Effect.tapErrorTag("SessionKeyError", () =>
      Metric.update(Metric.withAttributes(sessionKeyRevocationResults, { result: "not_found" }), 1),
    ),
    Effect.tapErrorTag("DatabaseError", () =>
      Metric.update(
        Metric.withAttributes(sessionKeyRevocationResults, { result: "persistence_failed" }),
        1,
      ),
    ),
    Effect.catchTag("DatabaseError", Effect.die),
  );
});
