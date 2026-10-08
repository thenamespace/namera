import { useCallback, useEffect, useRef } from "react";

import { useAtom, useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Cause, Option } from "effect";
import { AsyncResult, Atom } from "effect/reactivity";

import { currentAdminAtom } from "@/atoms/auth";
import { isAccessRejection } from "@/lib/access-rejection";

export function toQuery<A, E>(getAtom: () => Atom.Atom<AsyncResult.AsyncResult<A, E>>) {
  return function useQuery() {
    const atom = getAtom();
    const result = useAtomValue(atom);
    const refetch = useAtomRefresh(atom);
    const refreshSession = useAtomRefresh(currentAdminAtom);
    const error = Option.getOrNull(AsyncResult.error(result));
    useEffect(() => {
      if (atom !== currentAdminAtom && isAccessRejection(error)) refreshSession();
    }, [atom, error, refreshSession]);
    return {
      data: isAccessRejection(error) ? undefined : Option.getOrUndefined(AsyncResult.value(result)),
      error,
      refetch,
      isError: AsyncResult.isFailure(result),
      isFetching: result.waiting,
      isLoading: AsyncResult.isInitial(result) && result.waiting,
      isPending: result.waiting || AsyncResult.isInitial(result),
    };
  };
}

type Callbacks<A> = {
  onSuccess?: (value: A) => void;
  onError?: (error: unknown) => void;
  onSettled?: () => void;
};

export function toMutation<Input, A, E>(
  atom: Atom.AtomResultFn<Input, A, E>,
  options?: { readonly invalidates: readonly string[] },
) {
  return function useMutation(callbacks: Callbacks<A> = {}) {
    const [result, set] = useAtom(atom);
    const run = useAtomSet(atom, { mode: "promise" });
    const refreshSession = useAtomRefresh(currentAdminAtom);
    const callbacksRef = useRef(callbacks);
    callbacksRef.current = callbacks;
    const mutate = useCallback(
      (input: Omit<Input, "reactivityKeys">) => {
        void run({
          ...input,
          ...(options ? { reactivityKeys: options.invalidates } : {}),
        } as Input).then(
          (value) => {
            callbacksRef.current.onSuccess?.(value);
            callbacksRef.current.onSettled?.();
            return undefined;
          },
          (error: unknown) => {
            if (isAccessRejection(error)) refreshSession();
            callbacksRef.current.onError?.(error);
            callbacksRef.current.onSettled?.();
            return undefined;
          },
        );
      },
      [run, refreshSession],
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
