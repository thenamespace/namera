import type { ReactNode } from "react";

import { RegistryContext } from "@effect/atom-react";
import { AsyncResult, AtomRegistry } from "effect/reactivity";

import { useForm } from "react-hook-form";
import { afterEach, expect, it, onTestFinished, vi } from "vitest";
import { renderHook } from "vitest-browser-react";

import { useAutoSave } from "../../src/hooks/use-auto-save";
import { actor } from "../fixtures/actor";
import { browserSessionAtom } from "./session-fixture";

vi.mock("../../src/atoms/auth/session", async () => {
  const sessionFixture = await import("./session-fixture");
  return { currentUserAtom: sessionFixture.browserSessionAtom };
});

afterEach(() => vi.useRealTimers());

async function mountAutoSave(options: {
  onSave: (values: { name: string }) => Promise<void>;
  enabled?: boolean;
  flushOnUnmount?: boolean;
  validate?: () => Promise<boolean>;
}) {
  const registry = AtomRegistry.make();
  onTestFinished(() => registry.dispose());
  const session = browserSessionAtom;
  registry.mount(session);
  registry.set(session, AsyncResult.success(actor));
  vi.useFakeTimers();

  const hook = await renderHook(
    () => {
      const form = useForm({ defaultValues: { name: "Original" } });
      form.register("name", options.validate ? { validate: options.validate } : {});
      const autoSave = useAutoSave({ form, ...options, delay: 100 });
      return { form, ...autoSave };
    },
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <RegistryContext.Provider value={registry}>{children}</RegistryContext.Provider>
      ),
    },
  );

  return { ...hook, registry, session };
}

it("debounces edits and saves only the latest values", async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const hook = await mountAutoSave({ onSave });
  try {
    await hook.act(() => hook.result.current.form.setValue("name", "First"));
    await hook.act(() => vi.advanceTimersByTimeAsync(99));
    expect(onSave).not.toHaveBeenCalled();
    await hook.act(() => hook.result.current.form.setValue("name", "Latest"));
    await hook.act(() => vi.advanceTimersByTimeAsync(100));
    expect(onSave).toHaveBeenCalledExactlyOnceWith({ name: "Latest" });
    expect(hook.result.current.status).toBe("saved");
    expect(hook.result.current.hasPendingChanges).toBe(false);
  } finally {
    await hook.unmount();
    hook.registry.dispose();
  }
});

it("does not flush dirty changes after authority is lost", async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const hook = await mountAutoSave({ onSave });
  await hook.act(() => hook.result.current.form.setValue("name", "Unsaved"));
  hook.registry.set(hook.session, AsyncResult.initial());
  await hook.act(() => vi.advanceTimersByTimeAsync(100));
  await hook.unmount();
  hook.registry.dispose();
  expect(onSave).not.toHaveBeenCalled();
});

it("rechecks authority after asynchronous validation", async () => {
  let finishValidation!: (valid: boolean) => void;
  const validation = new Promise<boolean>((resolve) => {
    finishValidation = resolve;
  });
  const onSave = vi.fn().mockResolvedValue(undefined);
  const hook = await mountAutoSave({ onSave, validate: () => validation });
  await hook.act(() => hook.result.current.form.setValue("name", "Unsaved"));
  await hook.act(() => vi.advanceTimersByTimeAsync(100));
  hook.registry.set(hook.session, AsyncResult.initial());
  await hook.act(() => finishValidation(true));
  await hook.unmount();
  hook.registry.dispose();
  expect(onSave).not.toHaveBeenCalled();
});

it("serializes saves and dispatches edits made during the first save afterward", async () => {
  let finishFirstSave!: () => void;
  const firstSave = new Promise<void>((resolve) => {
    finishFirstSave = resolve;
  });
  const onSave = vi
    .fn()
    .mockImplementationOnce(() => firstSave)
    .mockResolvedValue(undefined);
  const hook = await mountAutoSave({ onSave });
  try {
    await hook.act(() => hook.result.current.form.setValue("name", "First"));
    await hook.act(() => vi.advanceTimersByTimeAsync(100));
    await hook.act(() => hook.result.current.form.setValue("name", "Second"));
    await hook.act(() => vi.advanceTimersByTimeAsync(100));
    expect(onSave).toHaveBeenCalledTimes(1);
    await hook.act(() => finishFirstSave());
    expect(onSave.mock.calls).toEqual([[{ name: "First" }], [{ name: "Second" }]]);
    expect(hook.result.current.hasPendingChanges).toBe(false);
  } finally {
    await hook.unmount();
    hook.registry.dispose();
  }
});

it("does not save read-only forms on debounce, pagehide or unmount", async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const hook = await mountAutoSave({ onSave, enabled: false });
  await hook.act(() => hook.result.current.form.setValue("name", "Read only"));
  await hook.act(() => vi.advanceTimersByTimeAsync(100));
  await hook.act(() => window.dispatchEvent(new Event("pagehide")));
  await hook.unmount();
  hook.registry.dispose();
  expect(onSave).not.toHaveBeenCalled();
});

it("keeps failed changes dirty and allows an explicit retry", async () => {
  const onSave = vi
    .fn()
    .mockRejectedValueOnce(new Error("Unavailable"))
    .mockResolvedValue(undefined);
  const hook = await mountAutoSave({ onSave });
  try {
    await hook.act(() => hook.result.current.form.setValue("name", "Retry me"));
    await hook.act(() => vi.advanceTimersByTimeAsync(100));
    expect(hook.result.current.status).toBe("error");
    expect(hook.result.current.hasPendingChanges).toBe(true);
    await hook.act(() => hook.result.current.save());
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(hook.result.current.status).toBe("saved");
    expect(hook.result.current.hasPendingChanges).toBe(false);
  } finally {
    await hook.unmount();
    hook.registry.dispose();
  }
});

it("flushes pending changes on unmount while authority is unchanged", async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const hook = await mountAutoSave({ onSave });
  await hook.act(() => hook.result.current.form.setValue("name", "Flush me"));
  await hook.unmount();
  hook.registry.dispose();
  expect(onSave).toHaveBeenCalledExactlyOnceWith({ name: "Flush me" });
});

it("resets the baseline without submitting or retaining a debounce timer", async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const hook = await mountAutoSave({ onSave });
  await hook.act(() => hook.result.current.form.setValue("name", "Loaded from server"));
  await hook.act(() => hook.result.current.resetBaseline());
  await hook.act(() => vi.advanceTimersByTimeAsync(100));
  expect(hook.result.current.hasPendingChanges).toBe(false);
  await hook.unmount();
  expect(onSave).not.toHaveBeenCalled();
});

it.each([true, false])(
  "honors flushOnUnmount=%s during pagehide and unmount",
  async (flushOnUnmount) => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const hook = await mountAutoSave({ onSave, flushOnUnmount });
    await hook.act(() => hook.result.current.form.setValue("name", "Leaving page"));
    await hook.act(() => window.dispatchEvent(new Event("pagehide")));
    await hook.unmount();
    await hook.act(() => vi.advanceTimersByTimeAsync(100));
    expect(onSave).toHaveBeenCalledTimes(flushOnUnmount ? 1 : 0);
  },
);
