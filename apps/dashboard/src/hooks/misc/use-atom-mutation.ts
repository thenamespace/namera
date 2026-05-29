// oxlint-disable no-underscore-dangle
import type { AsyncResult, Atom } from "effect/unstable/reactivity";

import { useAtomSet, useAtomValue } from "@effect/atom-react";

export function useAtomMutation<W, A>(
  atom: Atom.Writable<AsyncResult.AsyncResult<A, unknown>, W>,
) {
  const run = useAtomSet(atom, { mode: "promise" });
  const result = useAtomValue(atom);

  return {
    result,
    mutateAsync: run,
    isPending: result.waiting,
    isError: result._tag === "Failure",
    error: result._tag === "Failure" ? result.cause : null,
  };
}
