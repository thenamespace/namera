import { expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import { TransactionOverview } from "../../src/components/transaction-overview";

const review = {
  isOpen: true,
  title: "Review transaction",
  description: "Set this account's primary name.",
  rows: [{ id: "network", key: "Network", value: "Ethereum" }],
};

it("shows the reviewed context and requires an explicit confirmation", async () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  await render(<TransactionOverview {...review} onConfirm={onConfirm} onCancel={onCancel} />);

  await expect.element(page.getByRole("dialog")).toHaveAccessibleName("Review transaction");
  await expect.element(page.getByRole("dialog")).toHaveAttribute("aria-busy", "false");
  await expect.element(page.getByRole("dialog")).toHaveAccessibleDescription(review.description);
  await expect.element(page.getByText("Ethereum", { exact: true })).toBeVisible();
  expect(onConfirm).not.toHaveBeenCalled();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  expect(onConfirm).toHaveBeenCalledOnce();
  expect(onCancel).not.toHaveBeenCalled();
});

it("cancels without confirmation", async () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  await render(<TransactionOverview {...review} onConfirm={onConfirm} onCancel={onCancel} />);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(onCancel).toHaveBeenCalledOnce();
  expect(onConfirm).not.toHaveBeenCalled();
});

it("disables actions and dismissal while submission is pending", async () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  await render(
    <TransactionOverview
      {...review}
      isPending
      confirmText="Submitting…"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );

  await expect.element(page.getByRole("button", { name: "Submitting…" })).toBeDisabled();
  await expect.element(page.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
  await expect.element(page.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
  await userEvent.keyboard("{Escape}");
  expect(onConfirm).not.toHaveBeenCalled();
  expect(onCancel).not.toHaveBeenCalled();
});

it("allows keyboard cancellation when confirmation is unavailable", async () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  await render(
    <TransactionOverview {...review} isConfirmDisabled onConfirm={onConfirm} onCancel={onCancel} />,
  );

  await expect.element(page.getByRole("button", { name: "Confirm", exact: true })).toBeDisabled();
  await userEvent.keyboard("{Escape}");
  expect(onCancel).toHaveBeenCalledOnce();
  expect(onConfirm).not.toHaveBeenCalled();
});
