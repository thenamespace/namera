import { useCallback } from "react";

import { useAtom, useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";

import type { QueryKey } from "@/atoms/query-keys";

type MutationVariables<Input> = Omit<Input, "reactivityKeys">;
type MutationArguments<Input> =
  {} extends MutationVariables<Input>
    ? [input?: MutationVariables<Input>]
    : [input: MutationVariables<Input>];

export const toQuery = <Args extends readonly unknown[], A, E>(
  getAtom: (...args: Args) => Atom.Atom<AsyncResult.AsyncResult<A, E>>,
) => {
  return function useQuery(...args: Args) {
    const atom = getAtom(...args);
    const result = useAtomValue(atom);
    const refetch = useAtomRefresh(atom);
    const isPending = AsyncResult.isInitial(result);
    const isError = AsyncResult.isFailure(result);
    const isSuccess = AsyncResult.isSuccess(result);

    return {
      cause: isError ? result.cause : null,
      data: Option.getOrUndefined(AsyncResult.value(result)),
      error: Option.getOrNull(AsyncResult.error(result)),
      isError,
      isFetching: result.waiting,
      isLoading: isPending && result.waiting,
      isPending,
      isRefetching: !isPending && result.waiting,
      isSuccess,
      refetch,
      result,
      status: isPending
        ? ("pending" as const)
        : isError
          ? ("error" as const)
          : ("success" as const),
    };
  };
};

export const toMutation = <
  Input extends {
    readonly reactivityKeys?:
      | ReadonlyArray<unknown>
      | Readonly<Record<string, ReadonlyArray<unknown>>>
      | undefined;
  },
  A,
  E,
>(
  atom: Atom.AtomResultFn<Input, A, E>,
  options?: {
    readonly invalidates?:
      | ReadonlyArray<QueryKey>
      | ((input: MutationVariables<Input>) => ReadonlyArray<QueryKey>);
  },
) => {
  const invalidates = options?.invalidates;

  return function useMutation() {
    const [result, set] = useAtom(atom);
    const setAsync = useAtomSet(atom, { mode: "promise" });
    const isIdle = AsyncResult.isInitial(result) && !result.waiting;
    const isPending = result.waiting;
    const isError = AsyncResult.isFailure(result) && !isPending;
    const isSuccess = AsyncResult.isSuccess(result) && !isPending;
    const withInvalidation = useCallback((input: MutationVariables<Input>) => {
      if (!invalidates) {
        return input as Input;
      }

      return {
        ...input,
        reactivityKeys: typeof invalidates === "function" ? invalidates(input) : invalidates,
      } as Input;
    }, []);
    const mutate = useCallback(
      (...args: MutationArguments<Input>) =>
        set(withInvalidation((args[0] ?? {}) as MutationVariables<Input>)),
      [set, withInvalidation],
    );
    const mutateAsync = useCallback(
      (...args: MutationArguments<Input>) =>
        setAsync(withInvalidation((args[0] ?? {}) as MutationVariables<Input>)),
      [setAsync, withInvalidation],
    );
    const reset = useCallback(() => set(Atom.Reset), [set]);
    const cancel = useCallback(() => set(Atom.Interrupt), [set]);

    return {
      cancel,
      cause: isError ? result.cause : null,
      data: Option.getOrUndefined(AsyncResult.value(result)),
      error: isError ? Option.getOrNull(AsyncResult.error(result)) : null,
      isError,
      isIdle,
      isLoading: isPending,
      isPending,
      isSuccess,
      mutate,
      mutateAsync,
      reset,
      result,
      status: isPending
        ? ("pending" as const)
        : isError
          ? ("error" as const)
          : isSuccess
            ? ("success" as const)
            : ("idle" as const),
    };
  };
};
