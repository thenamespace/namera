// oxlint-disable typescript/no-non-null-assertion typescript/no-explicit-any
import { Context, Effect, Layer, Schema } from "effect";

import type { DatabaseError } from "@namera-ai/protocol";
import { type OrganizationId, type OrganizationMemberId, type UserId } from "@namera-ai/protocol";
import type { OrganizationRole } from "@namera-ai/protocol/model";
import {
  Organization,
  OrganizationMember,
  OrganizationMemberInsert,
  OrganizationMemberUpdate,
  User,
} from "@namera-ai/protocol/model";
import { eq } from "drizzle-orm";

import { Database, mapToDatabaseError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { decodeJoinedOrganizationRole } from "#/repositories/auth/organization/common";
import { organizationMember } from "#/schema/index";

export type OrganizationMemberRepository = {
  insert: (data: OrganizationMemberInsert) => Effect.Effect<OrganizationMember, DatabaseError>;
  findOrganizationMembersForOrg: (orgId: OrganizationId) => Effect.Effect<
    Array<{
      organizationMember: OrganizationMember;
      organizationRole: OrganizationRole;
      user: User;
    }>,
    DatabaseError
  >;
  findMembershipsForUser: (userId: UserId) => Effect.Effect<
    Array<{
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
  update: (
    id: OrganizationMemberId,
    data: OrganizationMemberUpdate,
  ) => Effect.Effect<OrganizationMember, DatabaseError>;
};

export const OrganizationMemberRepository = Context.Service<OrganizationMemberRepository>(
  "OrganizationMemberRepository",
);

export const layer: Layer.Layer<OrganizationMemberRepository, never, Database.Database> =
  Layer.effect(
    OrganizationMemberRepository,
    Effect.gen(function* () {
      const database = yield* Database.Database;

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
        update: Effect.fn("updateOrganizationMember")(function* (id, data) {
          const db = yield* transactionOrDatabase(database);
          const parsed = Schema.encodeSync(OrganizationMemberUpdate)(data);
          const res = yield* db
            .update(organizationMember)
            .set(parsed as any)
            .where(eq(organizationMember.id, id))
            .returning();

          return Schema.decodeSync(OrganizationMember)(res[0]!);
        }, mapToDatabaseError),
      });
    }),
  );
