import { useCallback, useRef } from "react";

import { useAtom, useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";

import type { QueryKey } from "@/atoms/query-keys";

type MutationVariables<Input> = Omit<Input, "reactivityKeys">;
type MutationArguments<Input> =
  {} extends MutationVariables<Input>
    ? [input?: MutationVariables<Input>]
    : [input: MutationVariables<Input>];

export type MutationOptions<Variables, A, E> = {
  readonly onError?: (error: E, variables: Variables) => void | Promise<void>;
  readonly onSettled?: (
    data: A | undefined,
    error: E | null,
    variables: Variables,
  ) => void | Promise<void>;
  readonly onSuccess?: (data: A, variables: Variables) => void | Promise<void>;
};

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

  return function useMutation(callbacks: MutationOptions<MutationVariables<Input>, A, E> = {}) {
    const [result, set] = useAtom(atom);
    const setAsync = useAtomSet(atom, { mode: "promise" });
    const callbacksRef = useRef(callbacks);
    callbacksRef.current = callbacks;

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
    const mutateAsync = useCallback(
      async (...args: MutationArguments<Input>) => {
        const variables = (args[0] ?? {}) as MutationVariables<Input>;
        let data: A;

        try {
          data = await setAsync(withInvalidation(variables));
        } catch (error) {
          await callbacksRef.current.onError?.(error as E, variables);
          await callbacksRef.current.onSettled?.(undefined, error as E, variables);

          throw error;
        }

        await callbacksRef.current.onSuccess?.(data, variables);
        await callbacksRef.current.onSettled?.(data, null, variables);

        return data;
      },
      [setAsync, withInvalidation],
    );
    const mutate = useCallback(
      (...args: MutationArguments<Input>) => {
        void mutateAsync(...args).catch(() => undefined);
      },
      [mutateAsync],
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
