import { Effect, Layer, Context, Schema } from "effect";

import {
  type Database,
  member,
  TransactionOrDatabase,
} from "@namera-ai/database";
import {
  DatabaseError,
  OrganizationError,
  OrganizationMember,
  OrganizationMemberInsert,
  mapDatabaseError,
} from "@namera-ai/schema";

export type MemberRepo = {
  create: (
    data: OrganizationMemberInsert,
  ) => Effect.Effect<
    OrganizationMember,
    DatabaseError | OrganizationError,
    Database.Database
  >;
};

export const MemberRepo = Context.Service<MemberRepo>("MemberRepo");

export const layer = Layer.succeed(
  MemberRepo,
  MemberRepo.of({
    create: (data) =>
      Effect.gen(function* () {
        const db = yield* TransactionOrDatabase;
        const res = yield* db.insert(member).values(data).returning();

        const returning = res[0];

        if (!returning) {
          return yield* new OrganizationError({
            code: "ORGANIZATION_MEMBER_NOT_FOUND",
          });
        }

        return Schema.decodeUnknownSync(OrganizationMember)(returning);
      }).pipe(mapDatabaseError),
  }),
);
