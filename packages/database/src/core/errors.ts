import { Effect } from "effect";
import { SqlError } from "effect/unstable/sql";

import { DatabaseError } from "@namera-ai/protocol";
import {
  EffectDrizzleError,
  EffectDrizzleQueryError,
  EffectTransactionRollbackError,
} from "drizzle-orm/effect-core";

type KnownDrizzleError =
  | EffectDrizzleError
  | EffectDrizzleQueryError
  | EffectTransactionRollbackError;

const isKnownDrizzleError = (error: unknown): error is KnownDrizzleError => {
  if (error instanceof EffectDrizzleError) return true;
  if (error instanceof EffectDrizzleQueryError) return true;
  if (error instanceof EffectTransactionRollbackError) return true;
  return false;
};

type KnownDatabaseError = SqlError.SqlError | KnownDrizzleError;

const isKnownDatabaseError = (error: unknown): error is KnownDatabaseError =>
  SqlError.isSqlError(error) || isKnownDrizzleError(error);

const toDatabaseError = (error: KnownDatabaseError) =>
  new DatabaseError({
    cause: error.cause,
    message: error.message,
  });

export type MapDatabaseError<E> = Exclude<E, Extract<E, KnownDatabaseError>> | DatabaseError;

export const mapToDatabaseError = <A, E, R>(effect: Effect.Effect<A, E, R>) => {
  const isMappedError = (error: E): error is Extract<E, KnownDatabaseError> =>
    isKnownDatabaseError(error);

  return Effect.catchIf(effect, isMappedError, (error) => Effect.fail(toDatabaseError(error)));
};

export const mapRepositoryError = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  mapToDatabaseError(effect).pipe(Effect.withTracerEnabled(false));
