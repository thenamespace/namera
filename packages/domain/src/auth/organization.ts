import { Effect, Layer, Schema, Context } from "effect";

import {
  type Database,
  organization,
  TransactionOrDatabase,
} from "@namera-ai/database";
import {
  ListOrganizationsResponse,
  Organization,
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

        return res as ListOrganizationsResponse;
      }).pipe(Effect.orDie),
  }),
);
