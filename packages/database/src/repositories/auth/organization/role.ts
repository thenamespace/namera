// oxlint-disable typescript/no-non-null-assertion typescript/no-explicit-any
import { Context, Effect, Layer, Schema } from "effect";

import type { DatabaseError, OrganizationId, OrganizationRoleId } from "@namera-ai/protocol";
import {
  type OrganizationRole,
  OrganizationRoleInsert,
  OrganizationRoleUpdate,
  SystemRole,
} from "@namera-ai/protocol/model";
import { and, eq, isNull } from "drizzle-orm";

import { Database, mapToDatabaseError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import {
  decodeJoinedOrganizationRole,
  decodeOrganizationRole,
  type OrganizationRoleRow,
} from "#/repositories/auth/organization/common";
import { organizationRole } from "#/schema/index";

export interface OrganizationRoleRepositoryService {
  insert: (data: OrganizationRoleInsert) => Effect.Effect<OrganizationRole, DatabaseError>;
  findById: (
    organizationId: OrganizationId,
    organizationRoleId: OrganizationRoleId,
  ) => Effect.Effect<OrganizationRole | undefined, DatabaseError>;
  findOrganizationRolesForOrgId: (
    orgId: OrganizationId,
  ) => Effect.Effect<ReadonlyArray<OrganizationRole>, DatabaseError>;
  findSystemRoles: () => Effect.Effect<ReadonlyArray<SystemRole>, DatabaseError>;
  updateCustom: (
    organizationId: OrganizationId,
    organizationRoleId: OrganizationRoleId,
    data: OrganizationRoleUpdate,
  ) => Effect.Effect<OrganizationRole | undefined, DatabaseError>;
}

export class OrganizationRoleRepository extends Context.Service<
  OrganizationRoleRepository,
  OrganizationRoleRepositoryService
>()("@namera-ai/database/OrganizationRoleRepository") {
  static readonly layer: Layer.Layer<OrganizationRoleRepository, never, Database> = Layer.effect(
    OrganizationRoleRepository,
    Effect.gen(function* () {
      const database = yield* Database;

      const decodeRole = Effect.fn("decodeOrganizationRole")(function* (
        roleRow: OrganizationRoleRow,
      ) {
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
      });

      return OrganizationRoleRepository.of({
        insert: Effect.fn("insertOrganizationRole")(function* (data) {
          const db = yield* transactionOrDatabase(database);
          const parsed = Schema.encodeSync(OrganizationRoleInsert)(data);
          const values =
            "systemRoleId" in parsed
              ? {
                  organizationId: parsed.organizationId,
                  systemRoleId: parsed.systemRoleId,
                  key: null,
                  metadata: null,
                  permissions: null,
                }
              : {
                  organizationId: parsed.organizationId,
                  systemRoleId: null,
                  key: parsed.key,
                  metadata: parsed.metadata,
                  permissions: parsed.permissions,
                };
          const res = yield* db
            .insert(organizationRole)
            .values(values as any)
            .returning();

          return yield* decodeRole(res[0]!);
        }, mapToDatabaseError),
        findById: Effect.fn("findOrganizationRoleById")(function* (
          organizationId,
          organizationRoleId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const res = yield* db.query.organizationRole.findFirst({
            where: {
              id: { eq: organizationRoleId },
              organizationId: { eq: organizationId },
            },
            with: {
              systemRole: true,
            },
          });

          return res ? decodeJoinedOrganizationRole(res) : undefined;
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
        updateCustom: Effect.fn("updateCustomOrganizationRole")(function* (
          organizationId,
          organizationRoleId,
          data,
        ) {
          const db = yield* transactionOrDatabase(database);
          const parsed = Schema.encodeSync(OrganizationRoleUpdate)(data);
          const res = yield* db
            .update(organizationRole)
            .set(parsed as any)
            .where(
              and(
                eq(organizationRole.id, organizationRoleId),
                eq(organizationRole.organizationId, organizationId),
                isNull(organizationRole.systemRoleId),
              ),
            )
            .returning();

          return res[0] ? yield* decodeRole(res[0]) : undefined;
        }, mapToDatabaseError),
      });
    }),
  );
}
