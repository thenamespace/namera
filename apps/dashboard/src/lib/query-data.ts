import { Option } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";

import { isAccessRejection } from "@/atoms/auth/browser-session";

/** A denied refresh is not permission to render its previous successful response. */
export function queryData<A, E>(result: AsyncResult.AsyncResult<A, E>): A | undefined {
  const error = Option.getOrUndefined(AsyncResult.error(result));
  if (isAccessRejection(error)) {
    return undefined;
  }
  return Option.getOrUndefined(AsyncResult.value(result));
}
