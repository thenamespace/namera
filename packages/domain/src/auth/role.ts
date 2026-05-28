import type { OrganizationError } from "@namera-ai/schema/dto";

import { Effect, Layer, Context, Schema } from "effect";

import {
  type Database,
  role,
  TransactionOrDatabase,
} from "@namera-ai/database";
import {
  DatabaseError,
  mapToDatabaseError,
  OrganizationId,
} from "@namera-ai/schema";
import {
  OrganizationRole,
  OrganizationRoleInsert,
} from "@namera-ai/schema/database";

export type RoleRepo = {
  createSystemRoles: (
    organizationId: OrganizationId,
  ) => Effect.Effect<
    OrganizationRole[],
    DatabaseError | OrganizationError,
    Database.Database
  >;
};

export const RoleRepo = Context.Service<RoleRepo>("RoleRepo");

export const layer = Layer.succeed(
  RoleRepo,
  RoleRepo.of({
    createSystemRoles: Effect.fn("createSystemRoles")(function* (orgId) {
      const db = yield* TransactionOrDatabase;

      const systemRoles = yield* db.query.systemRole.findMany({
        where: {
          deletedAt: { isNull: true },
        },
      });

      const toInsert: OrganizationRoleInsert[] = [];

      for (const systemRole of systemRoles) {
        toInsert.push({
          key: systemRole.key,
          metadata: systemRole.metadata,
          systemRoleId: systemRole.id,
          type: "system",
          permissions: [],
          version: 0,
          organizationId: orgId,
        });
      }

      const encoded = toInsert.map((e) =>
        Schema.encodeUnknownSync(OrganizationRoleInsert)(e),
      );

      const res = yield* db
        .insert(role)
        .values(encoded as any)
        .returning();

      return res.map((r) => Schema.decodeUnknownSync(OrganizationRole)(r));
    }, mapToDatabaseError),
  }),
);
