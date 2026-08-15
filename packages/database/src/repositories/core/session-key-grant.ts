// oxlint-disable typescript/no-explicit-any
import { Context, Effect, Layer, Schema } from "effect";

import type { ActorId, DatabaseError, OrganizationId } from "@namera-ai/protocol";
import {
  SessionKey,
  SessionKeyGrant,
  SessionKeyGrantInsert,
  type SessionKey as SessionKeyModel,
  type SessionKeyGrant as SessionKeyGrantModel,
  type SessionKeyGrantInsert as SessionKeyGrantInsertModel,
} from "@namera-ai/protocol/model";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { sessionKey, sessionKeyGrant } from "#/schema/index";

export interface SessionKeyGrantView {
  readonly grant: SessionKeyGrantModel;
  readonly sessionKey: SessionKeyModel;
}

export interface SessionKeyGrantRepositoryService {
  readonly insertMany: (
    data: ReadonlyArray<SessionKeyGrantInsertModel>,
  ) => Effect.Effect<ReadonlyArray<SessionKeyGrantModel>, DatabaseError>;
  readonly findActiveForActor: (
    organizationId: OrganizationId,
    actorId: ActorId,
  ) => Effect.Effect<ReadonlyArray<SessionKeyGrantView>, DatabaseError>;
  readonly findActiveForActors: (
    organizationId: OrganizationId,
    actorIds: ReadonlyArray<ActorId>,
  ) => Effect.Effect<ReadonlyArray<SessionKeyGrantView>, DatabaseError>;
}

export class SessionKeyGrantRepository extends Context.Service<
  SessionKeyGrantRepository,
  SessionKeyGrantRepositoryService
>()("@namera-ai/database/SessionKeyGrantRepository") {
  static readonly layer: Layer.Layer<SessionKeyGrantRepository, never, Database> = Layer.effect(
    SessionKeyGrantRepository,
    Effect.gen(function* () {
      const database = yield* Database;

      const findActiveForActors = Effect.fn(
        "database.sessionKeyGrantRepository.findActiveForActors",
      )(function* (organizationId: OrganizationId, actorIds: ReadonlyArray<ActorId>) {
        if (actorIds.length === 0) return [];
        const db = yield* transactionOrDatabase(database);
        const rows = yield* db
          .select({ grant: sessionKeyGrant, sessionKey })
          .from(sessionKeyGrant)
          .innerJoin(
            sessionKey,
            and(
              eq(sessionKey.id, sessionKeyGrant.sessionKeyId),
              eq(sessionKey.organizationId, sessionKeyGrant.organizationId),
            ),
          )
          .where(
            and(
              eq(sessionKeyGrant.organizationId, organizationId),
              inArray(sessionKeyGrant.actorId, actorIds),
              isNull(sessionKeyGrant.revokedAt),
              eq(sessionKey.status, "active"),
            ),
          )
          .orderBy(desc(sessionKeyGrant.createdAt), desc(sessionKeyGrant.id));
        return rows.map((row) => ({
          grant: Schema.decodeSync(SessionKeyGrant)(row.grant as any),
          sessionKey: Schema.decodeSync(SessionKey)(row.sessionKey as any),
        }));
      }, mapRepositoryError);

      return SessionKeyGrantRepository.of({
        insertMany: Effect.fn("database.sessionKeyGrantRepository.insertMany")(function* (data) {
          if (data.length === 0) return [];
          const db = yield* transactionOrDatabase(database);
          const encoded = data.map((item) => Schema.encodeSync(SessionKeyGrantInsert)(item));
          const rows = yield* db
            .insert(sessionKeyGrant)
            .values(encoded as any)
            .returning();
          return rows.map((row) => Schema.decodeSync(SessionKeyGrant)(row as any));
        }, mapRepositoryError),
        findActiveForActor: Effect.fn("database.sessionKeyGrantRepository.findActiveForActor")(
          function* (organizationId, actorId) {
            return yield* findActiveForActors(organizationId, [actorId]);
          },
        ),
        findActiveForActors,
      });
    }),
  );
}
