import { useEffect, useMemo, useRef, useState } from "react";

import { useBlocker } from "@tanstack/react-router";

import { toast } from "@namera-ai/ui";
import { useFormState, useWatch } from "react-hook-form";
import type { FieldValues, SubmitHandler, UseFormReturn } from "react-hook-form";
import { useDebounceCallback, useEventCallback, useIsMounted } from "usehooks-ts";

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

type UseAutoSaveOptions<TInput extends FieldValues, TContext, TOutput extends FieldValues> = {
  form: UseFormReturn<TInput, TContext, TOutput>;
  onSave: SubmitHandler<TOutput>;
  delay?: number;
  enabled?: boolean;
};

const getSignature = (value: unknown) => JSON.stringify(value) ?? "undefined";

export function useAutoSave<
  TInput extends FieldValues,
  TContext = unknown,
  TOutput extends FieldValues = TInput,
>({ delay = 2000, enabled = true, form, onSave }: UseAutoSaveOptions<TInput, TContext, TOutput>) {
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const values = useWatch({ control: form.control });
  const { isDirty } = useFormState({ control: form.control });
  const isMounted = useIsMounted();
  const currentSignature = useMemo(() => getSignature(values), [values]);
  const savedSignatureRef = useRef(getSignature(form.getValues()));
  const inFlightRef = useRef<Promise<boolean> | null>(null);
  const dirtyRef = useRef(isDirty);
  const enabledRef = useRef(enabled);

  dirtyRef.current = isDirty;
  enabledRef.current = enabled;

  const resetStatus = useDebounceCallback(() => {
    if (isMounted()) setStatus("idle");
  }, 2000);

  const performSave = useEventCallback(() => {
    if (inFlightRef.current) return inFlightRef.current;

    const task = (async () => {
      if (!enabledRef.current || !dirtyRef.current) return true;

      resetStatus.cancel();
      if (isMounted()) setStatus("saving");

      try {
        let saved = false;

        while (true) {
          const input = form.getValues();
          const inputSignature = getSignature(input);

          if (inputSignature === savedSignatureRef.current) break;

          let valid = false;
          // oxlint-disable-next-line no-await-in-loop -- overlapping saves must remain ordered
          await form.handleSubmit(
            async (output) => {
              await onSave(output);
              valid = true;
            },
            () => undefined,
          )();

          if (!valid) {
            if (isMounted()) setStatus("error");
            toast.warning("Fix the highlighted fields before leaving.");
            return false;
          }

          saved = true;
          savedSignatureRef.current = inputSignature;

          const changedWhileSaving = getSignature(form.getValues()) !== inputSignature;
          form.reset(input, {
            keepErrors: true,
            keepIsSubmitted: true,
            keepSubmitCount: true,
            keepTouched: true,
            keepValues: changedWhileSaving,
          });

          if (!changedWhileSaving) break;
        }

        if (isMounted()) setStatus(saved ? "saved" : "idle");
        if (saved) {
          toast.success("Saved");
          resetStatus();
        }

        return true;
      } catch {
        if (isMounted()) setStatus("error");
        toast.danger("Couldn’t save changes.");
        return false;
      }
    })();

    inFlightRef.current = task;
    void task.finally(() => {
      if (inFlightRef.current === task) inFlightRef.current = null;
    });

    return task;
  });

  const queueSave = useDebounceCallback(() => {
    void performSave();
  }, delay);

  const save = useEventCallback(() => {
    queueSave.cancel();
    return performSave();
  });

  useEffect(() => {
    if (!isDirty) {
      queueSave.cancel();
      if (!inFlightRef.current) savedSignatureRef.current = currentSignature;
      return;
    }

    if (!enabled) {
      queueSave.cancel();
      return;
    }

    queueSave();
    return queueSave.cancel;
  }, [currentSignature, enabled, isDirty, queueSave]);

  const shouldBlockNavigation = useEventCallback(async () => {
    if (!enabledRef.current || !dirtyRef.current) return false;
    return !(await save());
  });

  useBlocker({
    disabled: !enabled,
    enableBeforeUnload: () => enabledRef.current && dirtyRef.current,
    shouldBlockFn: shouldBlockNavigation,
  });

  return {
    hasPendingChanges: isDirty,
    save,
    status,
  };
}
