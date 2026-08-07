// oxlint-disable typescript/no-non-null-assertion typescript/no-explicit-any
import { Context, Effect, Layer, Schema } from "effect";

import type { DatabaseError } from "@namera-ai/protocol";
import { type OrganizationId, type UserId } from "@namera-ai/protocol";
import { Organization, OrganizationInsert, OrganizationUpdate } from "@namera-ai/protocol/model";
import { eq } from "drizzle-orm";

import { Database, mapToDatabaseError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { organization } from "#/schema/index";

export type OrganizationRepository = {
  insert: (data: OrganizationInsert) => Effect.Effect<Organization, DatabaseError>;
  findById: (id: OrganizationId) => Effect.Effect<Organization | undefined, DatabaseError>;
  findOrgsCreatedByUserId: (userId: UserId) => Effect.Effect<Array<Organization>, DatabaseError>;
  update: (
    orgId: OrganizationId,
    data: OrganizationUpdate,
  ) => Effect.Effect<Organization, DatabaseError>;
};

export const OrganizationRepository =
  Context.Service<OrganizationRepository>("OrganizationRepository");

export const layer: Layer.Layer<OrganizationRepository, never, Database.Database> = Layer.effect(
  OrganizationRepository,
  Effect.gen(function* () {
    const database = yield* Database.Database;

    return OrganizationRepository.of({
      insert: Effect.fn("insertOrganization")(function* (data) {
        const db = yield* transactionOrDatabase(database);
        const parsed = Schema.encodeSync(OrganizationInsert)(data);
        const res = yield* db
          .insert(organization)
          .values(parsed as any)
          .returning();

        return Schema.decodeSync(Organization)(res[0]!);
      }, mapToDatabaseError),
      findById: Effect.fn("findOrganizationById")(function* (id) {
        const db = yield* transactionOrDatabase(database);

        const res = yield* db.query.organization.findFirst({
          where: {
            id: { eq: id },
          },
        });

        return res ? Schema.decodeSync(Organization)(res) : undefined;
      }, mapToDatabaseError),
      findOrgsCreatedByUserId: Effect.fn("findOrgsCreatedByUserId")(function* (userId) {
        const db = yield* transactionOrDatabase(database);

        const res = yield* db.query.organization.findMany({
          where: {
            createdById: { eq: userId },
          },
        });

        return [...Schema.decodeSync(Schema.Array(Organization))(res)];
      }, mapToDatabaseError),
      update: Effect.fn("updateOrganization")(function* (orgId, data) {
        const db = yield* transactionOrDatabase(database);
        const parsed = Schema.encodeSync(OrganizationUpdate)(data);
        const res = yield* db
          .update(organization)
          .set(parsed as any)
          .where(eq(organization.id, orgId))
          .returning();

        return Schema.decodeSync(Organization)(res[0]!);
      }, mapToDatabaseError),
    });
  }),
);
