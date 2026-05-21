import { Effect, Layer, Schema, Context } from "effect";

import { sql } from "drizzle-orm";

import {
  type Database,
  organization,
  TransactionOrDatabase,
} from "@namera-ai/database";
import {
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
} from "@namera-ai/schema";

export type OrganizationRepo = {
  createOrganization: (
    data: OrganizationInsert,
  ) => Effect.Effect<Organization, never, Database.Database>;
  checkSlug: (
    slug: OrganizationSlug,
  ) => Effect.Effect<boolean, never, Database.Database>;
  listOrgsCreatedByUser: (
    userId: UserId,
  ) => Effect.Effect<Organization[], never, Database.Database>;
  list: (
    userId: UserId,
  ) => Effect.Effect<ListOrganizationsResponse, never, Database.Database>;
  hasActiveMembership: (
    userId: UserId,
    organizationId: OrganizationId,
    slug: OrganizationSlug,
  ) => Effect.Effect<boolean, never, Database.Database>;
  hasPermission: (
    userId: UserId,
    organizationId: OrganizationId,
    permission: Permission,
  ) => Effect.Effect<boolean, never, Database.Database>;
  getFullOrganization: (
    userId: UserId,
    params: GetFullOrganizationRequest,
  ) => Effect.Effect<Organization | undefined, never, Database.Database>;
  updateOrganization: (
    userId: UserId,
    params: UpdateOrganizationRequest,
  ) => Effect.Effect<Organization | undefined, never, Database.Database>;
  deleteOrganization: (
    userId: UserId,
    organizationId: OrganizationId,
  ) => Effect.Effect<boolean, never, Database.Database>;
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
  }).pipe(Effect.orDie);

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
      }).pipe(Effect.orDie),
    createOrganization: (data) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;
        const parsed = Schema.decodeSync(OrganizationInsert)(data);
        const res = yield* db.insert(organization).values(parsed).returning();
        // biome-ignore lint/style/noNonNullAssertion: safe
        return res[0]!;
      }).pipe(Effect.orDie),
    checkSlug: (slug: OrganizationSlug) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;
        const res = yield* db.query.organization.findFirst({
          where: {
            slug: { eq: slug },
          },
        });

        return Boolean(res);
      }).pipe(Effect.orDie),
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
      }).pipe(Effect.orDie),
    hasActiveMembership: (userId, organizationId, slug) =>
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

        return res?.organization?.slug === slug && !res.organization.deletedAt;
      }).pipe(Effect.orDie),
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
      }).pipe(Effect.orDie),
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
            sql`${organization.id} = ${params.id} AND ${organization.deletedAt} IS NULL`,
          )
          .returning();

        return res[0]
          ? Schema.decodeUnknownSync(Organization)(res[0])
          : undefined;
      }).pipe(Effect.orDie),
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
            updatedAt: new Date(),
          })
          .where(
            sql`${organization.id} = ${organizationId} AND ${organization.deletedAt} IS NULL`,
          )
          .returning({ id: organization.id });

        return Boolean(res[0]);
      }).pipe(Effect.orDie),
  }),
);
