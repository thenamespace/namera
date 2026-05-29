// oxlint-disable no-underscore-dangle
import type { Cause } from "effect";

import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";

export interface AtomQueryLike<A, E> {
  readonly data: A | undefined;
  readonly isPending: boolean;
  readonly isSuccess: boolean;
  readonly isError: boolean;
  readonly error: Cause.Cause<E> | null;
  readonly result: AsyncResult.AsyncResult<A, E>;
}

export function toQueryLike<A, E>(result: AsyncResult.AsyncResult<A, E>) {
  const value = AsyncResult.value(result);

  return {
    data: value._tag === "Some" ? value.value : undefined,
    isPending: result._tag === "Initial" || result.waiting,
    isSuccess: result._tag === "Success",
    isError: result._tag === "Failure",
    error: result._tag === "Failure" ? result.cause : null,
    result,
  } satisfies AtomQueryLike<A, E>;
}
