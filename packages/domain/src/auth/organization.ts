import { Effect, Layer, Schema, Context } from "effect";

import { and, eq, isNull } from "drizzle-orm";

import {
  type Database,
  organization,
  TransactionOrDatabase,
} from "@namera-ai/database";
import {
  DatabaseError,
  mapToDatabaseError,
  OrganizationId,
  UserId,
} from "@namera-ai/schema";
import {
  Organization,
  OrganizationInsert,
  OrganizationMember,
  OrganizationRole,
  OrganizationUpdate,
  type MemberPermission,
} from "@namera-ai/schema/database";
import {
  OrganizationError,
  type ListUserOrganizationsResponse,
} from "@namera-ai/schema/dto";

export type OrganizationRepo = {
  create: (
    data: OrganizationInsert,
  ) => Effect.Effect<
    Organization,
    DatabaseError | OrganizationError,
    Database.Database
  >;
  listOrgsCreatedByUser: (
    userId: UserId,
  ) => Effect.Effect<Organization[], DatabaseError, Database.Database>;
  listUserOrgs: (
    userId: UserId,
  ) => Effect.Effect<
    ListUserOrganizationsResponse,
    DatabaseError,
    Database.Database
  >;
  hasActiveMembership: (
    userId: UserId,
    organizationId: OrganizationId,
  ) => Effect.Effect<boolean, DatabaseError, Database.Database>;
  hasPermissions: (
    userId: UserId,
    organizationId: OrganizationId,
    permissions: MemberPermission[],
  ) => Effect.Effect<boolean, DatabaseError, Database.Database>;
  updateOrganization: (
    userId: UserId,
    orgId: OrganizationId,
    params: OrganizationUpdate,
  ) => Effect.Effect<
    Organization,
    DatabaseError | OrganizationError,
    Database.Database
  >;
};

export const OrganizationRepo =
  Context.Service<OrganizationRepo>("OrganizationRepo");

const hasPermissions = Effect.fnUntraced(function* (
  userId: UserId,
  organizationId: OrganizationId,
  permissions: MemberPermission[],
) {
  const db = yield* TransactionOrDatabase;

  const res = yield* db.query.member.findFirst({
    where: {
      userId: { eq: userId },
      organizationId: { eq: organizationId },
      deletedAt: { isNull: true },
      removedAt: { isNull: true },
    },
    with: {
      role: {
        where: {
          deletedAt: { isNull: true },
          organizationId: { eq: organizationId },
        },
      },
    },
  });

  const role = res?.role;

  if (!role) return false;

  return permissions.every((p) => role.permissions.includes(p));
}, mapToDatabaseError);

export const layer = Layer.succeed(
  OrganizationRepo,
  OrganizationRepo.of({
    listOrgsCreatedByUser: Effect.fn("listOrgsCreatedByUser")(function* (
      userId,
    ) {
      const db = yield* TransactionOrDatabase;
      const res = yield* db.query.organization.findMany({
        where: {
          createdById: { eq: userId },
          deletedAt: { isNull: true },
        },
      });

      return res.map((o) => Schema.decodeUnknownSync(Organization)(o));
    }, mapToDatabaseError),
    create: Effect.fn("createOrganization")(function* (data) {
      const db = yield* TransactionOrDatabase;
      const encoded = Schema.encodeSync(OrganizationInsert)(data);
      const res = yield* db
        .insert(organization)
        .values(encoded as any)
        .returning();

      const returning = res[0];

      if (!returning) {
        return yield* new OrganizationError({
          code: "ORGANIZATION_CREATE_FAILED",
        });
      }

      return Schema.decodeUnknownSync(Organization)(returning);
    }, mapToDatabaseError),
    listUserOrgs: Effect.fn("listUserOrgs")(function* (userId) {
      const db = yield* TransactionOrDatabase;

      const res = yield* db.query.member.findMany({
        where: {
          userId: { eq: userId },
          deletedAt: { isNull: true },
          removedAt: { isNull: true },
        },
        with: {
          organization: true,
          role: {
            with: {
              systemRole: true,
            },
          },
        },
      });

      const result: ListUserOrganizationsResponse = [];

      for (const r of res) {
        const { organization: org, role, ...restMember } = r;
        if (!org || !role) continue;
        const { systemRole, ...restRole } = role;

        const parsedOrg = Schema.decodeUnknownSync(Organization)(org);
        const parsedMember =
          Schema.decodeUnknownSync(OrganizationMember)(restMember);
        let parsedRole = {
          ...Schema.decodeUnknownSync(OrganizationRole)(restRole),
        };

        if (systemRole) {
          parsedRole.permissions = systemRole.permissions;
        }

        result.push({
          organization: parsedOrg,
          member: parsedMember,
          role: parsedRole,
        });
      }

      return result;
    }, mapToDatabaseError),
    hasActiveMembership: Effect.fn("hasActiveMembership")(function* (
      userId,
      organizationId,
    ) {
      const db = yield* TransactionOrDatabase;

      const res = yield* db.query.member.findFirst({
        where: {
          userId: { eq: userId },
          organizationId: { eq: organizationId },
          deletedAt: { isNull: true },
          removedAt: { isNull: true },
        },
        with: {
          organization: {
            where: {
              deletedAt: { isNull: true },
            },
          },
        },
      });

      if (res && res.organization) return true;
      return false;
    }, mapToDatabaseError),
    hasPermissions,
    updateOrganization: Effect.fn("updateOrganization")(function* (
      userId,
      orgId,
      params,
    ) {
      const db = yield* TransactionOrDatabase;

      const encoded = Schema.encodeSync(OrganizationUpdate)(params);
      const res = yield* db
        .update(organization)
        .set({
          ...(encoded as any),
          updatedAt: new Date(),
        })
        .where(and(eq(organization.id, orgId), isNull(organization.deletedAt)))
        .returning();

      const returning = res[0];

      if (!returning) {
        return yield* new OrganizationError({
          code: "ORGANIZATION_UPDATE_FAILED",
        });
      }

      return Schema.decodeUnknownSync(Organization)(returning);
    }, mapToDatabaseError),
  }),
);
