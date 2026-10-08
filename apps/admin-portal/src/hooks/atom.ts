import { useCallback, useRef } from "react";

import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Cause, Option } from "effect";
import { AsyncResult, Atom } from "effect/reactivity";

export function toQuery<A, E>(atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>) {
  return function useQuery() {
    const result = useAtomValue(atom);
    return {
      data: Option.getOrUndefined(AsyncResult.value(result)),
      error: AsyncResult.isFailure(result) ? result.cause : null,
      isPending: result.waiting || AsyncResult.isInitial(result),
    };
  };
}

type Callbacks<A> = {
  onSuccess?: (value: A) => void;
  onError?: (error: unknown) => void;
  onSettled?: () => void;
};

export function toMutation<Input, A, E>(atom: Atom.AtomResultFn<Input, A, E>) {
  return function useMutation(callbacks: Callbacks<A> = {}) {
    const [result, set] = useAtom(atom);
    const run = useAtomSet(atom, { mode: "promise" });
    const callbacksRef = useRef(callbacks);
    callbacksRef.current = callbacks;
    const mutate = useCallback(
      (input: Input) => {
        void run(input).then(
          (value) => {
            callbacksRef.current.onSuccess?.(value);
            callbacksRef.current.onSettled?.();
            return undefined;
          },
          (error: unknown) => {
            callbacksRef.current.onError?.(error);
            callbacksRef.current.onSettled?.();
            return undefined;
          },
        );
      },
      [run],
    );
    const reset = useCallback(() => set(Atom.Reset), [set]);
    return {
      mutate,
      reset,
      isPending: result.waiting,
      error: AsyncResult.isFailure(result) ? Cause.squash(result.cause) : null,
    };
  };
}
