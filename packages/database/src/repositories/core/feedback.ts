import { Context, DateTime, Effect, Layer, Schema } from "effect";

import type { OrganizationId, UserId } from "@namera-ai/protocol";
import {
  FeedbackView,
  type CreateFeedbackRequest,
  type ListFeedbackRequest,
} from "@namera-ai/protocol/dto";
import { Feedback, type FeedbackStatus } from "@namera-ai/protocol/model";
import { and, desc, eq, getTableColumns, lt } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { feedback, organization, user } from "#/schema/index";

const view = {
  ...getTableColumns(feedback),
  user: { email: user.email, metadata: user.metadata },
  organization: { metadata: organization.metadata },
};
const make = Effect.gen(function* () {
  const database = yield* Database;
  return {
    create: Effect.fn("database.feedback.create")(function* (
      input: CreateFeedbackRequest & {
        readonly userId: UserId;
        readonly organizationId: OrganizationId | null;
      },
    ) {
      const db = yield* transactionOrDatabase(database);
      const [row] = yield* db.insert(feedback).values(input).returning();
      return Schema.decodeUnknownSync(Feedback)(row);
    }, mapRepositoryError),
    list: Effect.fn("database.feedback.list")(function* (input: ListFeedbackRequest) {
      const db = yield* transactionOrDatabase(database);
      return Schema.decodeUnknownSync(Schema.Array(FeedbackView))(
        yield* db
          .select(view)
          .from(feedback)
          .innerJoin(user, eq(user.id, feedback.userId))
          .leftJoin(organization, eq(organization.id, feedback.organizationId))
          .where(
            and(
              input.cursor ? lt(feedback.id, input.cursor) : undefined,
              input.status ? eq(feedback.status, input.status) : undefined,
              input.category ? eq(feedback.category, input.category) : undefined,
            ),
          )
          .orderBy(desc(feedback.id))
          .limit((input.limit ?? 25) + 1),
      );
    }, mapRepositoryError),
    get: Effect.fn("database.feedback.get")(function* (id: string) {
      const db = yield* transactionOrDatabase(database);
      const [row] = yield* db
        .select(view)
        .from(feedback)
        .innerJoin(user, eq(user.id, feedback.userId))
        .leftJoin(organization, eq(organization.id, feedback.organizationId))
        .where(eq(feedback.id, id));
      return row ? Schema.decodeUnknownSync(FeedbackView)(row) : undefined;
    }, mapRepositoryError),
    updateStatus: Effect.fn("database.feedback.updateStatus")(function* (
      id: string,
      status: FeedbackStatus,
      now: DateTime.Utc,
    ) {
      const db = yield* transactionOrDatabase(database);
      const [row] = yield* db
        .update(feedback)
        .set({ status, updatedAt: DateTime.toDateUtc(now) })
        .where(eq(feedback.id, id))
        .returning();
      return row ? Schema.decodeUnknownSync(Feedback)(row) : undefined;
    }, mapRepositoryError),
  };
});

export class FeedbackRepository extends Context.Service<
  FeedbackRepository,
  Effect.Success<typeof make>
>()("@namera-ai/database/FeedbackRepository") {
  static readonly layer = Layer.effect(FeedbackRepository, make);
}
