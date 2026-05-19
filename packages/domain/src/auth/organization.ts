import { Effect, Layer, Schema, Context } from "effect";

import {
  type Database,
  organization,
  TransactionOrDatabase,
} from "@namera-ai/database";
import {
  ListOrganizationsResponse,
  Organization,
  OrganizationId,
  OrganizationInsert,
  OrganizationSlug,
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
};

export const OrganizationRepo =
  Context.Service<OrganizationRepo>("OrganizationRepo");

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
  }),
);
