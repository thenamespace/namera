// oxlint-disable typescript/no-non-null-assertion typescript/no-explicit-any
import { Context, Effect, Layer, Schema } from "effect";

import type { DatabaseError, OrganizationId, OrganizationRoleId } from "@namera-ai/protocol";
import {
  type OrganizationRole,
  OrganizationRoleInsert,
  OrganizationRoleUpdate,
  SystemRole,
} from "@namera-ai/protocol/model";
import { eq } from "drizzle-orm";

import { Database, mapToDatabaseError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import {
  decodeJoinedOrganizationRole,
  decodeOrganizationRole,
  type OrganizationRoleRow,
} from "#/repositories/auth/organization/common";
import { organizationRole } from "#/schema/index";

export type OrganizationRoleRepository = {
  insert: (data: OrganizationRoleInsert) => Effect.Effect<OrganizationRole, DatabaseError>;
  findOrganizationRolesForOrgId: (
    orgId: OrganizationId,
  ) => Effect.Effect<Array<OrganizationRole>, DatabaseError>;
  findSystemRoles: () => Effect.Effect<Array<SystemRole>, DatabaseError>;
  update: (
    organizationRoleId: OrganizationRoleId,
    data: OrganizationRoleUpdate,
  ) => Effect.Effect<OrganizationRole, DatabaseError>;
};

export const OrganizationRoleRepository = Context.Service<OrganizationRoleRepository>(
  "OrganizationRoleRepository",
);

export const layer: Layer.Layer<OrganizationRoleRepository, never, Database.Database> =
  Layer.effect(
    OrganizationRoleRepository,
    Effect.gen(function* () {
      const database = yield* Database.Database;

      const decodeRole = function* (roleRow: OrganizationRoleRow) {
        if (roleRow.systemRoleId === null) {
          return decodeOrganizationRole(roleRow);
        }

        const db = yield* transactionOrDatabase(database);
        const systemRole = yield* db.query.systemRole.findFirst({
          where: {
            id: { eq: roleRow.systemRoleId },
          },
        });

        return decodeOrganizationRole(roleRow, systemRole);
      };

      return OrganizationRoleRepository.of({
        insert: Effect.fn("insertOrganizationRole")(function* (data) {
          const db = yield* transactionOrDatabase(database);
          const parsed = Schema.encodeSync(OrganizationRoleInsert)(data);
          const res = yield* db
            .insert(organizationRole)
            .values(parsed as any)
            .returning();

          return yield* decodeRole(res[0]!);
        }, mapToDatabaseError),
        findOrganizationRolesForOrgId: Effect.fn("findOrganizationRolesForOrgId")(function* (
          orgId,
        ) {
          const db = yield* transactionOrDatabase(database);

          const res = yield* db.query.organizationRole.findMany({
            where: {
              organizationId: { eq: orgId },
            },
            with: {
              systemRole: true,
            },
          });

          return res.map(decodeJoinedOrganizationRole);
        }, mapToDatabaseError),
        findSystemRoles: Effect.fn("findSystemRoles")(function* () {
          const db = yield* transactionOrDatabase(database);

          const res = yield* db.query.systemRole.findMany();

          return [...Schema.decodeSync(Schema.Array(SystemRole))(res as any)];
        }, mapToDatabaseError),
        update: Effect.fn("updateOrganizationRole")(function* (organizationRoleId, data) {
          const db = yield* transactionOrDatabase(database);
          const parsed = Schema.encodeSync(OrganizationRoleUpdate)(data);
          const res = yield* db
            .update(organizationRole)
            .set(parsed as any)
            .where(eq(organizationRole.id, organizationRoleId))
            .returning();

          return yield* decodeRole(res[0]!);
        }, mapToDatabaseError),
      });
    }),
  );
