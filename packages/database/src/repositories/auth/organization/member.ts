// oxlint-disable typescript/no-non-null-assertion typescript/no-explicit-any
import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import type { DatabaseError } from "@namera-ai/protocol";
import {
  type ActorId,
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
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { decodeJoinedOrganizationRole } from "#/repositories/auth/organization/common";
import {
  organizationMember,
  organizationRole as organizationRoleTable,
  systemRole as systemRoleTable,
  user as userTable,
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
  findByActorIds: (
    organizationId: OrganizationId,
    actorIds: ReadonlyArray<ActorId>,
  ) => Effect.Effect<
    ReadonlyArray<{
      organizationMember: OrganizationMember;
      organizationRole: OrganizationRole;
      user: User;
    }>,
    DatabaseError
  >;
  findActiveById: (
    id: OrganizationMemberId,
    organizationId: OrganizationId,
  ) => Effect.Effect<
    | {
        organizationMember: OrganizationMember;
        organizationRole: OrganizationRole;
        user: User;
      }
    | undefined,
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
    expectedOrganizationRoleId: OrganizationRoleId,
    organizationRoleId: OrganizationRoleId,
  ) => Effect.Effect<OrganizationMember | undefined, DatabaseError>;
  remove: (
    id: OrganizationMemberId,
    organizationId: OrganizationId,
    expectedOrganizationRoleId: OrganizationRoleId,
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
        insert: Effect.fn("database.insertOrganizationMember")(function* (data) {
          const db = yield* transactionOrDatabase(database);
          const parsed = Schema.encodeSync(OrganizationMemberInsert)(data);
          const res = yield* db
            .insert(organizationMember)
            .values(parsed as any)
            .returning();

          return Schema.decodeSync(OrganizationMember)(res[0]!);
        }, mapRepositoryError),
        findOrganizationMembersForOrg: Effect.fn("database.findOrganizationMembersForOrg")(
          function* (orgId) {
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
          },
          mapRepositoryError,
        ),
        findByActorIds: Effect.fn("database.findOrganizationMembersByActorIds")(function* (
          organizationId,
          actorIds,
        ) {
          if (actorIds.length === 0) return [];
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .select({
              organizationMember,
              organizationRole: organizationRoleTable,
              systemRole: systemRoleTable,
              user: userTable,
            })
            .from(organizationMember)
            .innerJoin(userTable, eq(organizationMember.userId, userTable.id))
            .innerJoin(
              organizationRoleTable,
              and(
                eq(organizationMember.organizationRoleId, organizationRoleTable.id),
                eq(organizationMember.organizationId, organizationRoleTable.organizationId),
              ),
            )
            .leftJoin(systemRoleTable, eq(organizationRoleTable.systemRoleId, systemRoleTable.id))
            .where(
              and(
                eq(organizationMember.organizationId, organizationId),
                inArray(organizationMember.actorId, actorIds),
              ),
            );

          return rows.map((row) => ({
            organizationMember: Schema.decodeSync(OrganizationMember)(row.organizationMember),
            organizationRole: decodeJoinedOrganizationRole({
              ...row.organizationRole,
              systemRole: row.systemRole,
            }),
            user: Schema.decodeSync(User)(row.user),
          }));
        }, mapRepositoryError),
        findActiveById: Effect.fn("database.findActiveOrganizationMemberById")(function* (
          id,
          organizationId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const res = yield* db.query.organizationMember.findFirst({
            where: {
              id: { eq: id },
              organizationId: { eq: organizationId },
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

          if (!res) return undefined;
          const { organizationRole, user, ...organizationMemberRow } = res;
          return {
            organizationMember: Schema.decodeSync(OrganizationMember)(organizationMemberRow),
            organizationRole: decodeJoinedOrganizationRole(organizationRole),
            user: Schema.decodeSync(User)(user),
          };
        }, mapRepositoryError),
        findMembershipsForUser: Effect.fn("database.findMembershipsForUser")(function* (userId) {
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
        }, mapRepositoryError),
        findActiveMembership: Effect.fn("database.findActiveMembership")(function* (userId, orgId) {
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
        }, mapRepositoryError),
        assignRole: Effect.fn("database.assignOrganizationMemberRole")(function* (
          id,
          organizationId,
          expectedOrganizationRoleId,
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
                eq(organizationMember.organizationRoleId, expectedOrganizationRoleId),
                isNull(organizationMember.removedAt),
                sql`NOT EXISTS (
                  SELECT 1
                  FROM ${organizationRoleTable}
                  JOIN ${systemRoleTable}
                    ON ${systemRoleTable.id} = ${organizationRoleTable.systemRoleId}
                  WHERE ${organizationRoleTable.id} = ${organizationMember.organizationRoleId}
                    AND ${systemRoleTable.key} = 'owner'
                )`,
                sql`NOT EXISTS (
                  SELECT 1
                  FROM ${organizationRoleTable}
                  JOIN ${systemRoleTable}
                    ON ${systemRoleTable.id} = ${organizationRoleTable.systemRoleId}
                  WHERE ${organizationRoleTable.id} = ${organizationRoleId}
                    AND ${systemRoleTable.key} = 'owner'
                )`,
              ),
            )
            .returning();

          return res[0] ? Schema.decodeSync(OrganizationMember)(res[0]) : undefined;
        }, mapRepositoryError),
        remove: Effect.fn("database.removeOrganizationMember")(function* (
          id,
          organizationId,
          expectedOrganizationRoleId,
          removedAt,
        ) {
          const db = yield* transactionOrDatabase(database);
          const parsed = Schema.encodeSync(OrganizationMemberUpdate)({ removedAt });
          const res = yield* db
            .update(organizationMember)
            .set(parsed as any)
            .where(
              and(
                eq(organizationMember.id, id),
                eq(organizationMember.organizationId, organizationId),
                eq(organizationMember.organizationRoleId, expectedOrganizationRoleId),
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
        }, mapRepositoryError),
      });
    }),
  );
}
