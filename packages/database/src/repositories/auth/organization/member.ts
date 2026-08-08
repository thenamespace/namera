// oxlint-disable typescript/no-non-null-assertion typescript/no-explicit-any
import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import type { DatabaseError } from "@namera-ai/protocol";
import {
  type OrganizationId,
  type OrganizationMemberId,
  type OrganizationRoleId,
  type UserId,
} from "@namera-ai/protocol";
import type { OrganizationRole } from "@namera-ai/protocol/model";
import {
  Organization,
  OrganizationMember,
  OrganizationMemberInsert,
  OrganizationMemberUpdate,
  User,
} from "@namera-ai/protocol/model";
import { and, eq, isNull, sql } from "drizzle-orm";

import { Database, mapToDatabaseError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { decodeJoinedOrganizationRole } from "#/repositories/auth/organization/common";
import {
  organizationMember,
  organizationRole as organizationRoleTable,
  systemRole as systemRoleTable,
} from "#/schema/index";

export interface OrganizationMemberRepositoryService {
  insert: (data: OrganizationMemberInsert) => Effect.Effect<OrganizationMember, DatabaseError>;
  findOrganizationMembersForOrg: (orgId: OrganizationId) => Effect.Effect<
    ReadonlyArray<{
      organizationMember: OrganizationMember;
      organizationRole: OrganizationRole;
      user: User;
    }>,
    DatabaseError
  >;
  findMembershipsForUser: (userId: UserId) => Effect.Effect<
    ReadonlyArray<{
      organizationMember: OrganizationMember;
      organization: Organization;
      organizationRole: OrganizationRole;
      user: User;
    }>,
    DatabaseError
  >;
  findActiveMembership: (
    userId: UserId,
    orgId: OrganizationId,
  ) => Effect.Effect<
    | {
        organizationMember: OrganizationMember;
        organization: Organization;
        organizationRole: OrganizationRole;
        user: User;
      }
    | undefined,
    DatabaseError
  >;
  assignRole: (
    id: OrganizationMemberId,
    organizationId: OrganizationId,
    organizationRoleId: OrganizationRoleId,
  ) => Effect.Effect<OrganizationMember | undefined, DatabaseError>;
  remove: (
    id: OrganizationMemberId,
    organizationId: OrganizationId,
    removedAt: DateTime.Utc,
  ) => Effect.Effect<OrganizationMember | undefined, DatabaseError>;
}

export class OrganizationMemberRepository extends Context.Service<
  OrganizationMemberRepository,
  OrganizationMemberRepositoryService
>()("@namera-ai/database/OrganizationMemberRepository") {
  static readonly layer: Layer.Layer<OrganizationMemberRepository, never, Database> = Layer.effect(
    OrganizationMemberRepository,
    Effect.gen(function* () {
      const database = yield* Database;

      return OrganizationMemberRepository.of({
        insert: Effect.fn("insertOrganizationMember")(function* (data) {
          const db = yield* transactionOrDatabase(database);
          const parsed = Schema.encodeSync(OrganizationMemberInsert)(data);
          const res = yield* db
            .insert(organizationMember)
            .values(parsed as any)
            .returning();

          return Schema.decodeSync(OrganizationMember)(res[0]!);
        }, mapToDatabaseError),
        findOrganizationMembersForOrg: Effect.fn("findOrganizationMembersForOrg")(function* (
          orgId,
        ) {
          const db = yield* transactionOrDatabase(database);

          const res = yield* db.query.organizationMember.findMany({
            where: {
              organizationId: { eq: orgId },
              removedAt: { isNull: true },
            },
            with: {
              organizationRole: {
                with: {
                  systemRole: true,
                },
              },
              user: true,
            },
          });

          return res.map((row) => {
            const { organizationRole, user, ...organizationMemberRow } = row;

            return {
              organizationMember: Schema.decodeSync(OrganizationMember)(organizationMemberRow),
              organizationRole: decodeJoinedOrganizationRole(organizationRole),
              user: Schema.decodeSync(User)(user),
            };
          });
        }, mapToDatabaseError),
        findMembershipsForUser: Effect.fn("findMembershipsForUser")(function* (userId) {
          const db = yield* transactionOrDatabase(database);

          const res = yield* db.query.organizationMember.findMany({
            where: {
              userId: { eq: userId },
              removedAt: { isNull: true },
            },
            with: {
              organization: true,
              organizationRole: {
                with: {
                  systemRole: true,
                },
              },
              user: true,
            },
          });

          return res.map((row) => {
            const { organization, organizationRole, user, ...organizationMemberRow } = row;

            return {
              organizationMember: Schema.decodeSync(OrganizationMember)(organizationMemberRow),
              organization: Schema.decodeSync(Organization)(organization),
              organizationRole: decodeJoinedOrganizationRole(organizationRole),
              user: Schema.decodeSync(User)(user),
            };
          });
        }, mapToDatabaseError),
        findActiveMembership: Effect.fn("findActiveMembership")(function* (userId, orgId) {
          const db = yield* transactionOrDatabase(database);

          const res = yield* db.query.organizationMember.findFirst({
            where: {
              organizationId: { eq: orgId },
              removedAt: { isNull: true },
              userId: { eq: userId },
            },
            with: {
              organization: true,
              organizationRole: {
                with: {
                  systemRole: true,
                },
              },
              user: true,
            },
          });

          if (!res) {
            return undefined;
          }

          const { organization, organizationRole, user, ...organizationMemberRow } = res;

          return {
            organizationMember: Schema.decodeSync(OrganizationMember)(organizationMemberRow),
            organization: Schema.decodeSync(Organization)(organization),
            organizationRole: decodeJoinedOrganizationRole(organizationRole),
            user: Schema.decodeSync(User)(user),
          };
        }, mapToDatabaseError),
        assignRole: Effect.fn("assignOrganizationMemberRole")(function* (
          id,
          organizationId,
          organizationRoleId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const parsed = Schema.encodeSync(OrganizationMemberUpdate)({ organizationRoleId });
          const res = yield* db
            .update(organizationMember)
            .set(parsed as any)
            .where(
              and(
                eq(organizationMember.id, id),
                eq(organizationMember.organizationId, organizationId),
                isNull(organizationMember.removedAt),
                sql`NOT EXISTS (
                  SELECT 1
                  FROM ${organizationRoleTable}
                  JOIN ${systemRoleTable}
                    ON ${systemRoleTable.id} = ${organizationRoleTable.systemRoleId}
                  WHERE ${organizationRoleTable.id} = ${organizationMember.organizationRoleId}
                    AND ${systemRoleTable.key} = 'owner'
                )`,
              ),
            )
            .returning();

          return res[0] ? Schema.decodeSync(OrganizationMember)(res[0]) : undefined;
        }, mapToDatabaseError),
        remove: Effect.fn("removeOrganizationMember")(function* (id, organizationId, removedAt) {
          const db = yield* transactionOrDatabase(database);
          const parsed = Schema.encodeSync(OrganizationMemberUpdate)({ removedAt });
          const res = yield* db
            .update(organizationMember)
            .set(parsed as any)
            .where(
              and(
                eq(organizationMember.id, id),
                eq(organizationMember.organizationId, organizationId),
                isNull(organizationMember.removedAt),
                sql`NOT EXISTS (
                  SELECT 1
                  FROM ${organizationRoleTable}
                  JOIN ${systemRoleTable}
                    ON ${systemRoleTable.id} = ${organizationRoleTable.systemRoleId}
                  WHERE ${organizationRoleTable.id} = ${organizationMember.organizationRoleId}
                    AND ${systemRoleTable.key} = 'owner'
                )`,
              ),
            )
            .returning();

          return res[0] ? Schema.decodeSync(OrganizationMember)(res[0]) : undefined;
        }, mapToDatabaseError),
      });
    }),
  );
}
