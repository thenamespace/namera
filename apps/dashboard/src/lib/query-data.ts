import { Option, Predicate } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";

/** A denied refresh is not permission to render its previous successful response. */
export function queryData<A, E>(result: AsyncResult.AsyncResult<A, E>): A | undefined {
  const error = Option.getOrUndefined(AsyncResult.error(result));
  if (Predicate.isTagged(error, "Unauthorized") || Predicate.isTagged(error, "Forbidden")) {
    return undefined;
  }
  return Option.getOrUndefined(AsyncResult.value(result));
}
