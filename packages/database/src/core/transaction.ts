import type { UserId } from "@namera-ai/schema";

import { Effect, Context } from "effect";

import type { Database } from "./layer";
import { TransactionOrDatabase } from "./tx-or-db";

export type TransactionClient = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];
export const TransactionClient =
  Context.Service<TransactionClient>("TransactionClient");

export const withTx = (tx: TransactionClient) =>
  Effect.provideService(TransactionClient, tx);

export type ActorContext =
  | {
      actorType: "user";
      userId: UserId;
    }
  | {
      actorType: "api_key";
      actorId: string;
    };

export const setActorContext = (ctx: ActorContext) =>
  Effect.gen(function* () {
    const db = yield* TransactionOrDatabase;

    yield* db.execute(`SET LOCAL app.actor_type = '${ctx.actorType}'`);

    if (ctx.actorType === "user") {
      yield* db.execute(`SET LOCAL app.user_id = '${ctx.userId}'`);
    }
  });
