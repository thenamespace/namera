import { Schema, Effect } from "effect";

import {
  EffectDrizzleError,
  EffectDrizzleQueryError,
  EffectTransactionRollbackError,
} from "drizzle-orm/effect-core";
import { SqlError } from "effect/unstable/sql";

export class Unauthorized extends Schema.TaggedErrorClass<Unauthorized>()(
  "Unauthorized",
  {},
  { httpApiStatus: 401 },
) {}

export class DatabaseError extends Schema.TaggedErrorClass<DatabaseError>()(
  "DatabaseError",
  {
    cause: Schema.Defect,
    message: Schema.optional(Schema.String),
  },
  { httpApiStatus: 500 },
) {}

type KnownDrizzleError =
  | EffectDrizzleError
  | EffectDrizzleQueryError
  | EffectTransactionRollbackError;

const isKnownDrizzleError = (e: unknown): e is KnownDrizzleError => {
  if (e instanceof EffectDrizzleError) return true;
  if (e instanceof EffectDrizzleQueryError) return true;
  if (e instanceof EffectTransactionRollbackError) return true;
  return false;
};

type KnownDatabaseError = SqlError.SqlError | KnownDrizzleError;

const isKnownDatabaseError = (e: unknown): e is KnownDatabaseError =>
  SqlError.isSqlError(e) || isKnownDrizzleError(e);

const toDatabaseError = (e: KnownDatabaseError) =>
  new DatabaseError({
    cause: e.cause,
    message: e.message,
  });

type MapDatabaseError<E> = [Extract<E, KnownDatabaseError>] extends [never]
  ? E
  : Exclude<E, KnownDatabaseError> | DatabaseError;

export const mapDatabaseError = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, MapDatabaseError<E>, R> =>
  effect.pipe(
    Effect.catchIf(
      (e) => isKnownDatabaseError(e),
      (e) => Effect.fail(toDatabaseError(e as KnownDatabaseError)),
    ),
  ) as Effect.Effect<A, MapDatabaseError<E>, R>;
