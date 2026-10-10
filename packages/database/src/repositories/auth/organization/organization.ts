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
import { and, count, eq, isNull } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import {
  organization,
  organizationMember,
  organizationRole,
  systemRole,
  user,
} from "#/schema/index";

export interface OrganizationRepositoryService {
  countOwnedForUpdate: (userId: UserId) => Effect.Effect<number, DatabaseError>;
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
        countOwnedForUpdate: Effect.fn("database.organization.countOwnedForUpdate")(function* (
          userId,
        ) {
          const db = yield* transactionOrDatabase(database);
          // Serialize all ownership admissions for this user, including different orgs.
          yield* db.select({ id: user.id }).from(user).where(eq(user.id, userId)).for("update");
          const rows = yield* db
            .select({ value: count() })
            .from(organizationMember)
            .innerJoin(
              organizationRole,
              eq(organizationMember.organizationRoleId, organizationRole.id),
            )
            .innerJoin(systemRole, eq(organizationRole.systemRoleId, systemRole.id))
            .where(
              and(
                eq(organizationMember.userId, userId),
                isNull(organizationMember.removedAt),
                eq(systemRole.key, "owner"),
              ),
            );
          return rows[0]?.value ?? 0;
        }, mapRepositoryError),
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
