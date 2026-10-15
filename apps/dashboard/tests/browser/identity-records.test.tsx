// oxlint-disable react-perf/jsx-no-new-object-as-prop
import { EnsLabel } from "@namera-ai/protocol";
import { beforeEach, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { RecordDialog } from "../../src/routes/_authenticated/identity/-components/record-dialog";
import { managedWallet } from "../fixtures/wallet-transaction";

const boundary = vi.hoisted(() => ({
  mutate: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  callbacks: {} as { onSuccess?: () => void; onError?: (error: Error) => void },
}));

vi.mock("../../src/hooks/identity", () => ({
  useIdentityNetworks: () => ({ data: [{ key: "60", label: "Ethereum", coinType: "60" }] }),
  useUpdateIdentityRecords: (callbacks: typeof boundary.callbacks) => {
    boundary.callbacks = callbacks;
    return { mutate: boundary.mutate, isPending: false };
  },
}));
vi.mock("../../src/lib/toasts", () => ({
  showErrorToast: boundary.error,
  showSuccessToast: boundary.success,
}));

beforeEach(() => {
  boundary.mutate.mockReset();
  boundary.success.mockReset();
  boundary.error.mockReset();
});

it.each([
  {
    type: "text" as const,
    key: "description",
    value: "Original description",
    next: "Changed description",
    field: "Value",
  },
  {
    type: "address" as const,
    key: "60",
    value: managedWallet.address,
    next: `0x${"22".repeat(20)}`,
    field: "Address",
  },
])("retains a failed $type edit and removes only the original selected key", async (record) => {
  const close = vi.fn();
  const refresh = vi.fn();
  const label = EnsLabel.make("example");
  const draft = { type: record.type, key: record.key, value: record.value, existing: true };
  await render(
    <RecordDialog
      walletId={managedWallet.id}
      label={label}
      draft={draft}
      onClose={close}
      onRefresh={refresh}
    />,
  );
  boundary.mutate.mockImplementationOnce(() => boundary.callbacks.onError?.(new Error("Offline")));
  await page.getByRole("textbox", { name: record.field, exact: true }).fill(record.next);
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  expect(boundary.mutate).toHaveBeenCalledExactlyOnceWith({
    params: { walletId: managedWallet.id, label },
    payload: { changes: [{ type: record.type, key: record.key, value: record.next }] },
  });
  expect(refresh).toHaveBeenCalledOnce();
  expect(close).not.toHaveBeenCalled();
  await expect
    .element(page.getByRole("textbox", { name: record.field, exact: true }))
    .toHaveValue(record.next);
  await page.getByRole("button", { name: "Remove record", exact: true }).click();
  expect(boundary.mutate).toHaveBeenLastCalledWith({
    params: { walletId: managedWallet.id, label },
    payload: { changes: [{ type: record.type, key: record.key, value: null }] },
  });
});

it("does not send an empty record and closes only after a successful save", async () => {
  const close = vi.fn();
  const draft = { type: "text" as const, key: "", value: "", existing: false };
  await render(
    <RecordDialog
      walletId={managedWallet.id}
      label={EnsLabel.make("example")}
      draft={draft}
      onClose={close}
      onRefresh={vi.fn()}
    />,
  );
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  expect(boundary.mutate).not.toHaveBeenCalled();
  await page.getByRole("textbox", { name: "Key", exact: true }).fill("description");
  await page.getByRole("textbox", { name: "Value", exact: true }).fill("My identity");
  boundary.mutate.mockImplementationOnce(() => boundary.callbacks.onSuccess?.());
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  expect(close).toHaveBeenCalledOnce();
  expect(boundary.success).toHaveBeenCalledWith({ title: "Record saved" });
});
