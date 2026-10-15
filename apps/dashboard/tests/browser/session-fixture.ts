import { AsyncResult, Atom } from "effect/reactivity";

import { actor } from "../fixtures/actor";

export const browserSessionAtom = Atom.make<AsyncResult.AsyncResult<typeof actor>>(
  AsyncResult.success(actor),
);
