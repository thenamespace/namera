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
  debug = true,
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

  const log = useCallback(
    (message: string, data?: Record<string, unknown>) => {
      if (!debug) return;

      console.log(`[useAutoSave] ${message}`, data ?? {});
    },
    [debug],
  );

  const clearSaveTimeout = useCallback(() => {
    if (!timeoutRef.current) return;

    log("clearing queued save");
    clearTimeout(timeoutRef.current);
    timeoutRef.current = undefined;
  }, [log]);

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
      log("save invoked", {
        currentValues: form.getValues(),
        baseline: baselineRef.current,
        inFlight: inFlightRef.current,
        silent,
      });

      clearSaveTimeout();

      const data = form.getValues();
      const dataSignature = stableStringify(data);
      if (dataSignature === baselineRef.current) {
        log("save skipped: current values match baseline", {
          data,
          dataSignature,
        });
        return;
      }

      if (inFlightRef.current) {
        log("save deferred: request already in flight");
        rerunAfterSaveRef.current = true;
        return;
      }

      const isValid = await form.trigger();
      if (!isValid) {
        log("save skipped: form validation failed", {
          errors: form.formState.errors,
        });
        return;
      }

      inFlightRef.current = true;
      if (!silent) setStatusIfMounted("saving");
      log("calling onSave", { data });

      try {
        await onSaveRef.current(data);
        baselineRef.current = dataSignature;
        if (!silent) setStatusIfMounted("saved");
        log("save succeeded", {
          savedSignature: dataSignature,
        });
        if (!silent) {
          clearStatusTimeout();
          statusResetRef.current = setTimeout(
            () => setStatusIfMounted("idle"),
            2000,
          );
        }
      } catch (error) {
        console.error("Auto-save failed:", error);
        log("save failed", { error });
        if (!silent) setStatusIfMounted("error");
      } finally {
        inFlightRef.current = false;

        if (rerunAfterSaveRef.current) {
          log("rerunning save after in-flight changes");
          rerunAfterSaveRef.current = false;
          void save(options);
        }
      }
    },
    [clearSaveTimeout, clearStatusTimeout, form, log, setStatusIfMounted],
  );

  const queueSave = useCallback(() => {
    clearSaveTimeout();
    log("queueing save", {
      delay,
      values,
      currentSignature,
      baseline: baselineRef.current,
    });
    timeoutRef.current = setTimeout(() => {
      void save();
    }, delay);
  }, [clearSaveTimeout, currentSignature, delay, log, save, values]);

  useEffect(() => {
    onSaveRef.current = onSave;
    log("onSave ref updated");
  }, [onSave]);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    log("values observed", {
      values,
      currentSignature,
      baseline: baselineRef.current,
      hasPendingChanges,
    });

    if (!hasPendingChanges) {
      log("not queueing: no pending changes");
      return;
    }

    queueSave();
  }, [currentSignature, hasPendingChanges, log, queueSave, values]);

  useEffect(() => {
    const flushPendingChanges = () => {
      if (!flushOnUnmount) return;

      const dataSignature = stableStringify(form.getValues());
      if (dataSignature === baselineRef.current) return;

      log("flushing pending changes before unmount/page hide", {
        values: form.getValues(),
        baseline: baselineRef.current,
      });
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
  }, [clearSaveTimeout, clearStatusTimeout, flushOnUnmount, form, log]);

  const resetBaseline = useCallback(
    (nextValues: T = form.getValues()) => {
      baselineRef.current = stableStringify(nextValues);
      log("baseline reset", {
        nextValues,
        baseline: baselineRef.current,
      });
    },
    [form, log],
  );

  return {
    status,
    isSaving: status === "saving",
    hasPendingChanges,
    flush: save,
    resetBaseline,
  };
}
