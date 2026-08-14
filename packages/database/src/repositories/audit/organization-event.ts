// oxlint-disable typescript/no-explicit-any typescript/no-non-null-assertion
import { Context, Effect, Layer, Schema } from "effect";

import type { DatabaseError, OrganizationId } from "@namera-ai/protocol";
import { OrganizationEvent, OrganizationEventInsert } from "@namera-ai/protocol/model";
import { desc, eq } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { organizationEvent } from "#/schema/index";

export interface OrganizationEventRepositoryService {
  readonly insert: (
    data: OrganizationEventInsert,
  ) => Effect.Effect<OrganizationEvent, DatabaseError>;
  readonly findForOrganization: (
    organizationId: OrganizationId,
    limit?: number,
  ) => Effect.Effect<ReadonlyArray<OrganizationEvent>, DatabaseError>;
}

export class OrganizationEventRepository extends Context.Service<
  OrganizationEventRepository,
  OrganizationEventRepositoryService
>()("@namera-ai/database/OrganizationEventRepository") {
  static readonly layer: Layer.Layer<OrganizationEventRepository, never, Database> = Layer.effect(
    OrganizationEventRepository,
    Effect.gen(function* () {
      const database = yield* Database;

      return OrganizationEventRepository.of({
        insert: Effect.fn("database.organizationEventRepository.insert")(function* (data) {
          const db = yield* transactionOrDatabase(database);
          const parsed = Schema.encodeSync(OrganizationEventInsert)(data);
          const rows = yield* db
            .insert(organizationEvent)
            .values(parsed as any)
            .returning();

          return Schema.decodeSync(OrganizationEvent)(rows[0]! as any);
        }, mapRepositoryError),
        findForOrganization: Effect.fn("database.organizationEventRepository.findForOrganization")(
          function* (organizationId, limit = 100) {
            const db = yield* transactionOrDatabase(database);
            const rows = yield* db
              .select()
              .from(organizationEvent)
              .where(eq(organizationEvent.organizationId, organizationId))
              .orderBy(desc(organizationEvent.createdAt))
              .limit(limit);

            return Schema.decodeSync(Schema.Array(OrganizationEvent))(rows as any);
          },
          mapRepositoryError,
        ),
      });
    }),
  );
}
