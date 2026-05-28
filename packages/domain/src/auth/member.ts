import { Effect, Layer, Context, Schema } from "effect";

import {
  type Database,
  member,
  TransactionOrDatabase,
} from "@namera-ai/database";
import { DatabaseError, mapToDatabaseError } from "@namera-ai/schema";
import {
  OrganizationMember,
  OrganizationMemberInsert,
} from "@namera-ai/schema/database";
import { OrganizationError } from "@namera-ai/schema/dto";

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
    create: Effect.fn("createMember")(function* (data) {
      const db = yield* TransactionOrDatabase;
      const encoded = Schema.encodeUnknownSync(OrganizationMemberInsert)(data);
      const res = yield* db
        .insert(member)
        .values(encoded as any)
        .returning();

      const returning = res[0];

      if (!returning) {
        return yield* new OrganizationError({
          code: "ORGANIZATION_MEMBER_NOT_FOUND",
        });
      }

      return Schema.decodeUnknownSync(OrganizationMember)(returning);
    }, mapToDatabaseError),
  }),
);
