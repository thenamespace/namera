import { Effect, Layer, Context } from "effect";

import {
  type Database,
  role,
  TransactionOrDatabase,
} from "@namera-ai/database";
import {
  DatabaseError,
  OrganizationError,
  OrganizationId,
  OrganizationRole,
  mapDatabaseError,
  memberRole,
  ownerRole,
} from "@namera-ai/schema";

export type RoleRepo = {
  createSystemRoles: (
    organizationId: OrganizationId,
  ) => Effect.Effect<
    { ownerRole: OrganizationRole; memberRole: OrganizationRole },
    DatabaseError | OrganizationError,
    Database.Database
  >;
};

export const RoleRepo = Context.Service<RoleRepo>("RoleRepo");

export const layer = Layer.succeed(
  RoleRepo,
  RoleRepo.of({
    createSystemRoles: (orgId) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;
        const res = yield* db
          .insert(role)
          .values([
            {
              ...ownerRole,
              organizationId: orgId,
            },
            {
              ...memberRole,
              organizationId: orgId,
            },
          ])
          .returning();

        return { ownerRole: res[0]!, memberRole: res[1]! };
      }).pipe(mapDatabaseError),
  }),
);
