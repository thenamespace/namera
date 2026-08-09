// oxlint-disable typescript/no-non-null-assertion typescript/no-explicit-any
import { Context, Effect, Layer, Schema } from "effect";

import type { DatabaseError } from "@namera-ai/protocol";
import { Actor, ActorInsert } from "@namera-ai/protocol/model";

import { Database, mapToDatabaseError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { actor } from "#/schema/index";

export interface ActorRepositoryService {
  insert: (data: ActorInsert) => Effect.Effect<Actor, DatabaseError>;
}

export class ActorRepository extends Context.Service<ActorRepository, ActorRepositoryService>()(
  "@namera-ai/database/ActorRepository",
) {
  static readonly layer: Layer.Layer<ActorRepository, never, Database> = Layer.effect(
    ActorRepository,
    Effect.gen(function* () {
      const database = yield* Database;

      return ActorRepository.of({
        insert: Effect.fn("ActorRepository.insert")(function* (data) {
          const db = yield* transactionOrDatabase(database);
          const parsed = Schema.encodeSync(ActorInsert)(data);
          const rows = yield* db
            .insert(actor)
            .values(parsed as any)
            .returning();

          return Schema.decodeSync(Actor)(rows[0]!);
        }, mapToDatabaseError),
      });
    }),
  );
}
