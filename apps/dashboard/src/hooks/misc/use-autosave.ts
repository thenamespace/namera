import type {
  FieldValues,
  SubmitHandler,
  UseFormReturn,
} from "react-hook-form";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useWatch } from "react-hook-form";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface UseAutoSaveOptions<T extends FieldValues> {
  form: UseFormReturn<T>;
  onSave: SubmitHandler<T>;
  delay?: number;
  debug?: boolean;
  flushOnUnmount?: boolean;
}

const stableStringify = (value: unknown) => JSON.stringify(value);
type SaveOptions = {
  silent?: boolean;
};

export function useAutoSave<T extends FieldValues>({
  form,
  onSave,
  delay = 4000,
  flushOnUnmount = true,
}: UseAutoSaveOptions<T>) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const values = useWatch({ control: form.control });
  const onSaveRef = useRef(onSave);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const statusResetRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const baselineRef = useRef(stableStringify(form.getValues()));
  const inFlightRef = useRef(false);
  const rerunAfterSaveRef = useRef(false);
  const mountedRef = useRef(true);
  const saveRef = useRef<(options?: SaveOptions) => Promise<void>>(
    async () => {},
  );

  const currentSignature = useMemo(() => stableStringify(values), [values]);
  const hasPendingChanges = currentSignature !== baselineRef.current;

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

  const setStatusIfMounted = useCallback((nextStatus: SaveStatus) => {
    if (!mountedRef.current) return;

    setStatus(nextStatus);
  }, []);

  const save = useCallback(
    async (options: SaveOptions = {}) => {
      const { silent = false } = options;

      clearSaveTimeout();

      const data = form.getValues();
      const dataSignature = stableStringify(data);

      if (inFlightRef.current) {
        rerunAfterSaveRef.current = true;
        return;
      }

      const isValid = await form.trigger();
      if (!isValid) {
        return;
      }

      inFlightRef.current = true;
      if (!silent) setStatusIfMounted("saving");

      try {
        await onSaveRef.current(data);
        baselineRef.current = dataSignature;
        if (!silent) setStatusIfMounted("saved");

        if (!silent) {
          clearStatusTimeout();
          statusResetRef.current = setTimeout(
            () => setStatusIfMounted("idle"),
            2000,
          );
        }
      } catch (error) {
        console.error("Auto-save failed:", error);
        if (!silent) setStatusIfMounted("error");
      } finally {
        inFlightRef.current = false;

        if (rerunAfterSaveRef.current) {
          rerunAfterSaveRef.current = false;
          void save(options);
        }
      }
    },
    [clearSaveTimeout, clearStatusTimeout, form, setStatusIfMounted],
  );

  const queueSave = useCallback(() => {
    clearSaveTimeout();
    timeoutRef.current = setTimeout(() => {
      void save();
    }, delay);
  }, [clearSaveTimeout, currentSignature, delay, save, values]);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    queueSave();
  }, [currentSignature, hasPendingChanges, queueSave, values]);

  useEffect(() => {
    const flushPendingChanges = () => {
      if (!flushOnUnmount) return;

      const dataSignature = stableStringify(form.getValues());
      if (dataSignature === baselineRef.current) return;

      void saveRef.current({ silent: true });
    };

    const handlePageHide = () => {
      flushPendingChanges();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushPendingChanges();
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      flushPendingChanges();
      clearSaveTimeout();
      clearStatusTimeout();
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [clearSaveTimeout, clearStatusTimeout, flushOnUnmount, form]);

  const resetBaseline = useCallback(
    (nextValues: T = form.getValues()) => {
      baselineRef.current = stableStringify(nextValues);
    },
    [form],
  );

  return {
    status,
    isSaving: status === "saving",
    hasPendingChanges,
    flush: save,
    resetBaseline,
  };
}
