// oxlint-disable typescript/no-non-null-assertion typescript/no-explicit-any
import { Context, Effect, Layer, Schema } from "effect";

import type { DatabaseError } from "@namera-ai/protocol";
import { type OrganizationId, type UserId } from "@namera-ai/protocol";
import {
  Organization,
  OrganizationInsert,
  type OrganizationMetadata,
  OrganizationUpdate,
} from "@namera-ai/protocol/model";
import { eq } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { organization } from "#/schema/index";

export interface OrganizationRepositoryService {
  insert: (data: OrganizationInsert) => Effect.Effect<Organization, DatabaseError>;
  findById: (id: OrganizationId) => Effect.Effect<Organization | undefined, DatabaseError>;
  findOrgsCreatedByUserId: (
    userId: UserId,
  ) => Effect.Effect<ReadonlyArray<Organization>, DatabaseError>;
  update: (
    orgId: OrganizationId,
    metadata: OrganizationMetadata,
  ) => Effect.Effect<Organization | undefined, DatabaseError>;
}

export class OrganizationRepository extends Context.Service<
  OrganizationRepository,
  OrganizationRepositoryService
>()("@namera-ai/database/OrganizationRepository") {
  static readonly layer: Layer.Layer<OrganizationRepository, never, Database> = Layer.effect(
    OrganizationRepository,
    Effect.gen(function* () {
      const database = yield* Database;

      return OrganizationRepository.of({
        insert: Effect.fn("database.insertOrganization")(function* (data) {
          const db = yield* transactionOrDatabase(database);
          const parsed = Schema.encodeSync(OrganizationInsert)(data);
          const res = yield* db
            .insert(organization)
            .values(parsed as any)
            .returning();

          return Schema.decodeSync(Organization)(res[0]!);
        }, mapRepositoryError),
        findById: Effect.fn("database.findOrganizationById")(function* (id) {
          const db = yield* transactionOrDatabase(database);

          const res = yield* db.query.organization.findFirst({
            where: {
              id: { eq: id },
            },
          });

          return res ? Schema.decodeSync(Organization)(res) : undefined;
        }, mapRepositoryError),
        findOrgsCreatedByUserId: Effect.fn("database.findOrgsCreatedByUserId")(function* (userId) {
          const db = yield* transactionOrDatabase(database);

          const res = yield* db.query.organization.findMany({
            where: {
              createdById: { eq: userId },
            },
          });

          return [...Schema.decodeSync(Schema.Array(Organization))(res)];
        }, mapRepositoryError),
        update: Effect.fn("database.updateOrganization")(function* (orgId, metadata) {
          const db = yield* transactionOrDatabase(database);
          const parsed = Schema.encodeSync(OrganizationUpdate)({ metadata });
          const res = yield* db
            .update(organization)
            .set(parsed as any)
            .where(eq(organization.id, orgId))
            .returning();

          return res[0] ? Schema.decodeSync(Organization)(res[0]) : undefined;
        }, mapRepositoryError),
      });
    }),
  );
}
