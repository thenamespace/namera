import { Effect, Layer, Schema, Context } from "effect";

import { and, eq, isNull } from "drizzle-orm";

import {
  type Database,
  organization,
  TransactionOrDatabase,
} from "@namera-ai/database";
import {
  DatabaseError,
  GetFullOrganizationRequest,
  GetFullOrganizationResponse,
  ListOrganizationsResponse,
  Organization,
  OrganizationError,
  OrganizationId,
  OrganizationInsert,
  OrganizationSlug,
  OrganizationUpdate,
  Permission,
  UpdateOrganizationRequest,
  UserId,
  mapDatabaseError,
} from "@namera-ai/schema";

export type OrganizationRepo = {
  create: (
    data: OrganizationInsert,
  ) => Effect.Effect<
    Organization,
    DatabaseError | OrganizationError,
    Database.Database
  >;
  checkSlug: (
    slug: OrganizationSlug,
  ) => Effect.Effect<boolean, DatabaseError, Database.Database>;
  listOrgsCreatedByUser: (
    userId: UserId,
  ) => Effect.Effect<Organization[], DatabaseError, Database.Database>;
  list: (
    userId: UserId,
  ) => Effect.Effect<
    ListOrganizationsResponse,
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
    permissions: Permission[],
  ) => Effect.Effect<boolean, DatabaseError, Database.Database>;
  getFullOrganization: (
    params: GetFullOrganizationRequest,
  ) => Effect.Effect<
    GetFullOrganizationResponse,
    DatabaseError | OrganizationError,
    Database.Database
  >;
  updateOrganization: (
    userId: UserId,
    params: UpdateOrganizationRequest,
  ) => Effect.Effect<
    Organization,
    DatabaseError | OrganizationError,
    Database.Database
  >;
};

export const OrganizationRepo =
  Context.Service<OrganizationRepo>("OrganizationRepo");

const hasPermissions = (
  userId: UserId,
  organizationId: OrganizationId,
  permissions: Permission[],
) =>
  Effect.gen(function* () {
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

    return permissions.every((permission) =>
      role.permissions.includes(permission),
    );
  }).pipe(mapDatabaseError);

export const layer = Layer.succeed(
  OrganizationRepo,
  OrganizationRepo.of({
    listOrgsCreatedByUser: (userId) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;
        const res = yield* db.query.organization.findMany({
          where: {
            createdById: { eq: userId },
            deletedAt: { isNull: true },
          },
        });

        return res;
      }).pipe(mapDatabaseError),
    create: (data) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;
        const parsed = Schema.decodeSync(OrganizationInsert)(data);
        const res = yield* db.insert(organization).values(parsed).returning();

        const returning = res[0];

        if (!returning) {
          return yield* new OrganizationError({
            code: "ORGANIZATION_CREATE_FAILED",
          });
        }
        return returning;
      }).pipe(mapDatabaseError),
    checkSlug: (slug: OrganizationSlug) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;
        const res = yield* db.query.organization.findFirst({
          where: {
            slug: { eq: slug },
            deletedAt: { isNull: true },
          },
        });

        return Boolean(res);
      }).pipe(mapDatabaseError),
    list: (userId) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;

        const res = yield* db.query.member.findMany({
          where: {
            userId: { eq: userId },
            deletedAt: { isNull: true },
            removedAt: { isNull: true },
          },
          with: {
            organization: true,
          },
        });

        return res.filter((m) => m.organization) as ListOrganizationsResponse;
      }).pipe(mapDatabaseError),
    hasActiveMembership: (userId, organizationId) =>
      Effect.gen(function* () {
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
      }).pipe(mapDatabaseError),
    hasPermissions,
    getFullOrganization: (params) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;

        const res = yield* db.query.organization.findFirst({
          where: {
            id: { eq: params.id },
            deletedAt: { isNull: true },
          },
          with: {
            members: {
              limit: params.membersLimit,
              where: {
                removedAt: { isNull: true },
                deletedAt: { isNull: true },
              },
            },
          },
        });

        if (!res) {
          return yield* new OrganizationError({
            code: "ORGANIZATION_NOT_FOUND",
          });
        }

        return res;
      }).pipe(mapDatabaseError),
    updateOrganization: (userId, params) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;
        const canUpdate = yield* hasPermissions(userId, params.id, [
          "org:update",
        ]);

        if (!canUpdate) {
          return yield* new OrganizationError({
            code: "INSUFFICIENT_PERMISSIONS",
          });
        }

        const parsed = Schema.decodeSync(OrganizationUpdate)(params.data);
        const res = yield* db
          .update(organization)
          .set({
            ...parsed,
            updatedAt: new Date(),
          })
          .where(
            and(eq(organization.id, params.id), isNull(organization.deletedAt)),
          )
          .returning();

        const returning = res[0];

        if (!returning) {
          return yield* new OrganizationError({
            code: "ORGANIZATION_UPDATE_FAILED",
          });
        }

        return Schema.decodeUnknownSync(Organization)(returning);
      }).pipe(mapDatabaseError),
  }),
);
