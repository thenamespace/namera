import { useCallback, useContext, useEffect, useRef, useState } from "react";

import { RegistryContext } from "@effect/atom-react";

import {
  useWatch,
  type FieldValues,
  type SubmitHandler,
  type UseFormReturn,
} from "react-hook-form";

import { canSaveInAuthority, sessionAuthority } from "@/atoms/auth/authority";
import { currentUserAtom } from "@/atoms/auth/session";
import { queryData } from "@/lib/query-data";

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

interface UseAutoSaveOptions<T extends FieldValues, TTransformedValues> {
  form: UseFormReturn<T, unknown, TTransformedValues>;
  onSave: SubmitHandler<TTransformedValues>;
  delay?: number;
  enabled?: boolean;
  flushOnUnmount?: boolean;
}

const stableStringify = (value: unknown) => JSON.stringify(value);

type SaveOptions = {
  silent?: boolean;
};

export function useAutoSave<T extends FieldValues, TTransformedValues = T>({
  form,
  onSave,
  delay = 3000,
  enabled = true,
  flushOnUnmount = true,
}: UseAutoSaveOptions<T, TTransformedValues>) {
  const registry = useContext(RegistryContext);
  const authority = useRef(sessionAuthority(queryData(registry.get(currentUserAtom))));
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const [baselineSignature, setBaselineSignature] = useState(() =>
    stableStringify(form.getValues()),
  );
  const watchedValues = useWatch({ control: form.control });
  const hasPendingChanges = enabled && stableStringify(watchedValues) !== baselineSignature;
  const onSaveRef = useRef(onSave);
  const enabledRef = useRef(enabled);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const statusResetRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const baselineRef = useRef(baselineSignature);
  const observedSignatureRef = useRef(baselineSignature);
  const inFlightRef = useRef(false);
  const rerunAfterSaveRef = useRef(false);
  const mountedRef = useRef(true);
  const saveRef = useRef<(options?: SaveOptions) => Promise<void>>(async () => {});

  const clearSaveTimeout = useCallback(() => {
    if (!timeoutRef.current) return;

    clearTimeout(timeoutRef.current);
    timeoutRef.current = undefined;
  }, []);

  const clearStatusTimeout = useCallback(() => {
    if (!statusResetRef.current) return;

    clearTimeout(statusResetRef.current);
    statusResetRef.current = undefined;
  }, []);

  const setStatusIfMounted = useCallback((nextStatus: AutoSaveStatus) => {
    if (mountedRef.current) setStatus(nextStatus);
  }, []);

  const save = useCallback(
    async (options: SaveOptions = {}) => {
      clearSaveTimeout();
      if (
        !enabledRef.current ||
        !canSaveInAuthority(
          authority.current,
          sessionAuthority(queryData(registry.get(currentUserAtom))),
        )
      )
        return;

      const data = form.getValues();
      const dataSignature = stableStringify(data);
      if (dataSignature === baselineRef.current) {
        return;
      }

      if (inFlightRef.current) {
        rerunAfterSaveRef.current = true;
        return;
      }

      inFlightRef.current = true;
      if (!options.silent) setStatusIfMounted("saving");

      try {
        let didSave = false;
        await form.handleSubmit(async (validatedData) => {
          // Validation may be asynchronous; recheck before dispatching a write.
          if (
            !canSaveInAuthority(
              authority.current,
              sessionAuthority(queryData(registry.get(currentUserAtom))),
            )
          )
            return;
          await onSaveRef.current(validatedData);
          didSave = true;
        })();
        if (!didSave) {
          setStatusIfMounted("idle");
          return;
        }

        baselineRef.current = dataSignature;

        if (mountedRef.current) setBaselineSignature(dataSignature);

        if (!options.silent) {
          setStatusIfMounted("saved");
          clearStatusTimeout();
          statusResetRef.current = setTimeout(() => setStatusIfMounted("idle"), 2000);
        }
      } catch {
        if (!options.silent) setStatusIfMounted("error");
      } finally {
        inFlightRef.current = false;

        if (rerunAfterSaveRef.current) {
          rerunAfterSaveRef.current = false;
          void saveRef.current(options);
        }
      }
    },
    [clearSaveTimeout, clearStatusTimeout, form, registry, setStatusIfMounted],
  );

  const queueSave = useCallback(() => {
    clearSaveTimeout();
    timeoutRef.current = setTimeout(() => void save(), delay);
  }, [clearSaveTimeout, delay, save]);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    enabledRef.current = enabled;

    if (!enabled) {
      clearSaveTimeout();
      return;
    }

    const pending = stableStringify(form.getValues()) !== baselineRef.current;
    if (pending) queueSave();
  }, [clearSaveTimeout, enabled, form, queueSave]);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(
    () =>
      form.subscribe({
        formState: { values: true },
        callback: ({ values }) => {
          const signature = stableStringify(values);
          if (signature === observedSignatureRef.current) return;

          observedSignatureRef.current = signature;
          const pending = enabledRef.current && signature !== baselineRef.current;

          if (pending) queueSave();
          else clearSaveTimeout();
        },
      }),
    [clearSaveTimeout, form, queueSave],
  );

  useEffect(() => {
    mountedRef.current = true;

    const flushPendingChanges = () => {
      if (!flushOnUnmount || !enabledRef.current) return;
      if (stableStringify(form.getValues()) === baselineRef.current) return;

      void saveRef.current({ silent: true });
    };

    window.addEventListener("pagehide", flushPendingChanges);

    return () => {
      window.removeEventListener("pagehide", flushPendingChanges);
      clearSaveTimeout();
      clearStatusTimeout();
      flushPendingChanges();
      mountedRef.current = false;
    };
  }, [clearSaveTimeout, clearStatusTimeout, flushOnUnmount, form]);

  const resetBaseline = useCallback(
    (nextValue?: T) => {
      const signature = stableStringify(nextValue ?? form.getValues());
      baselineRef.current = signature;
      observedSignatureRef.current = signature;
      clearSaveTimeout();
      clearStatusTimeout();
      if (mountedRef.current) setBaselineSignature(signature);
      setStatusIfMounted("idle");
    },
    [clearSaveTimeout, clearStatusTimeout, form, setStatusIfMounted],
  );

  return { hasPendingChanges, resetBaseline, save, status };
}
