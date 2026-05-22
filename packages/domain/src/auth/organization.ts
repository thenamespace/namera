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
  ListOrganizationsResponse,
  Organization,
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
  ) => Effect.Effect<Organization, DatabaseError, Database.Database>;
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
  hasPermission: (
    userId: UserId,
    organizationId: OrganizationId,
    permission: Permission,
  ) => Effect.Effect<boolean, DatabaseError, Database.Database>;
  getFullOrganization: (
    userId: UserId,
    params: GetFullOrganizationRequest,
  ) => Effect.Effect<
    Organization | undefined,
    DatabaseError,
    Database.Database
  >;
  updateOrganization: (
    userId: UserId,
    params: UpdateOrganizationRequest,
  ) => Effect.Effect<
    Organization | undefined,
    DatabaseError,
    Database.Database
  >;
  deleteOrganization: (
    userId: UserId,
    organizationId: OrganizationId,
  ) => Effect.Effect<boolean, DatabaseError, Database.Database>;
};

export const OrganizationRepo =
  Context.Service<OrganizationRepo>("OrganizationRepo");

const hasPermission = (
  userId: UserId,
  organizationId: OrganizationId,
  permission: Permission,
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
        role: true,
      },
    });

    if (!res?.role || res.role.deletedAt) {
      return false;
    }

    return (
      res.role.organizationId === organizationId &&
      res.role.permissions.includes(permission)
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
        return res[0]!;
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

        return (
          res.filter((m) => m.organization) as ListOrganizationsResponse
        ).filter((m) => m.organization.deletedAt === null);
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
            organization: true,
          },
        });

        return Boolean(res && res.organization && !res.organization.deletedAt);
      }).pipe(mapDatabaseError),
    hasPermission,
    getFullOrganization: (userId, params) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;

        const res = yield* db.query.member.findFirst({
          where: {
            userId: { eq: userId },
            organizationId: { eq: params.id },
            deletedAt: { isNull: true },
            removedAt: { isNull: true },
          },
          with: {
            organization: true,
          },
        });

        if (
          !res?.organization ||
          res.organization.slug !== params.slug ||
          res.organization.deletedAt
        ) {
          return undefined;
        }

        return Schema.decodeUnknownSync(Organization)(res.organization);
      }).pipe(mapDatabaseError),
    updateOrganization: (userId, params) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;
        const canUpdate = yield* hasPermission(userId, params.id, "org:update");

        if (!canUpdate) {
          return undefined;
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

        return res[0]
          ? Schema.decodeUnknownSync(Organization)(res[0])
          : undefined;
      }).pipe(mapDatabaseError),
    deleteOrganization: (userId, organizationId) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;
        const canDelete = yield* hasPermission(
          userId,
          organizationId,
          "org:delete",
        );

        if (!canDelete) {
          return false;
        }

        const res = yield* db
          .update(organization)
          .set({
            deletedAt: new Date(),
          })
          .where(
            and(
              eq(organization.id, organizationId),
              isNull(organization.deletedAt),
            ),
          )
          .returning({ id: organization.id });

        return Boolean(res[0]);
      }).pipe(mapDatabaseError),
  }),
);
