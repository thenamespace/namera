import { Effect } from "effect";
import { HttpApiError } from "effect/unstable/httpapi";

export const notImplemented = Effect.fail(new HttpApiError.NotImplemented());
