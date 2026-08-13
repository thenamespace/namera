import { useCallback, useEffect, useRef, useState } from "react";

import type { FieldValues, SubmitHandler, UseFormReturn } from "react-hook-form";

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
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const onSaveRef = useRef(onSave);
  const enabledRef = useRef(enabled);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const statusResetRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const baselineRef = useRef(stableStringify(form.getValues()));
  const observedSignatureRef = useRef(baselineRef.current);
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

  const setPendingIfMounted = useCallback((pending: boolean) => {
    if (mountedRef.current) setHasPendingChanges(pending);
  }, []);

  const save = useCallback(
    async (options: SaveOptions = {}) => {
      clearSaveTimeout();
      if (!enabledRef.current) return;

      const data = form.getValues();
      const dataSignature = stableStringify(data);
      if (dataSignature === baselineRef.current) {
        setPendingIfMounted(false);
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
          await onSaveRef.current(validatedData);
          didSave = true;
        })();
        if (!didSave) {
          setStatusIfMounted("idle");
          return;
        }

        baselineRef.current = dataSignature;

        const currentSignature = stableStringify(form.getValues());
        const stillPending = currentSignature !== baselineRef.current;
        setPendingIfMounted(stillPending);

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
          void save(options);
        }
      }
    },
    [clearSaveTimeout, clearStatusTimeout, form, setPendingIfMounted, setStatusIfMounted],
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
      setHasPendingChanges(false);
      return;
    }

    const pending = stableStringify(form.getValues()) !== baselineRef.current;
    setHasPendingChanges(pending);
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
          setPendingIfMounted(pending);

          if (pending) queueSave();
          else clearSaveTimeout();
        },
      }),
    [clearSaveTimeout, form, queueSave, setPendingIfMounted],
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
      setPendingIfMounted(false);
      setStatusIfMounted("idle");
    },
    [clearSaveTimeout, clearStatusTimeout, form, setPendingIfMounted, setStatusIfMounted],
  );

  return { hasPendingChanges, resetBaseline, save, status };
}
