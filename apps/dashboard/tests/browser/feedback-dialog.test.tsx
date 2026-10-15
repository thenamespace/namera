import { beforeEach, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import { FeedbackDialog } from "../../src/components/feedback/dialog";

const boundary = vi.hoisted(() => ({
  mutate: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  pending: false,
  callbacks: {} as { onSuccess?: () => void; onError?: (error: Error) => void },
}));

vi.mock("@tanstack/react-router", () => ({ useLocation: () => "/identity" }));
vi.mock("../../src/hooks/feedback", () => ({
  useCreateFeedback: (callbacks: typeof boundary.callbacks) => {
    boundary.callbacks = callbacks;
    return { mutate: boundary.mutate, isPending: boundary.pending };
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
  boundary.pending = false;
});

it("retains the selected category and message on failure and retries the same draft", async () => {
  const close = vi.fn();
  await render(<FeedbackDialog onClose={close} />);
  await page.getByRole("button", { name: /Category/ }).click();
  await page.getByRole("option", { name: "Report a bug", exact: true }).click();
  await page.getByRole("textbox", { name: /Message/ }).fill("Identity record failed to save.");
  boundary.mutate.mockImplementationOnce(() => boundary.callbacks.onError?.(new Error("Offline")));
  await page.getByRole("button", { name: "Send feedback", exact: true }).click();
  expect(close).not.toHaveBeenCalled();
  await expect
    .element(page.getByRole("textbox", { name: /Message/ }))
    .toHaveValue("Identity record failed to save.");
  expect(boundary.mutate).toHaveBeenCalledExactlyOnceWith({
    payload: {
      category: "bug",
      data: { version: 1, message: "Identity record failed to save." },
      pagePath: "/identity",
    },
  });
  boundary.mutate.mockImplementationOnce(() => boundary.callbacks.onSuccess?.());
  await page.getByRole("button", { name: "Send feedback", exact: true }).click();
  expect(boundary.mutate.mock.calls[1]).toEqual(boundary.mutate.mock.calls[0]);
  expect(close).toHaveBeenCalledOnce();
});

it("blocks duplicate submission and dismissal while sending, then restores the draft", async () => {
  const close = vi.fn();
  const view = await render(<FeedbackDialog onClose={close} />);
  await page.getByRole("textbox", { name: /Message/ }).fill("Please improve this view.");
  await page.getByRole("button", { name: "Send feedback", exact: true }).click();
  boundary.pending = true;
  await view.rerender(<FeedbackDialog onClose={close} />);
  await expect.element(page.getByRole("button", { name: "Sending…", exact: true })).toBeDisabled();
  await expect.element(page.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
  await userEvent.keyboard("{Escape}");
  expect(close).not.toHaveBeenCalled();
  expect(boundary.mutate).toHaveBeenCalledOnce();
  boundary.pending = false;
  await view.rerender(<FeedbackDialog onClose={close} />);
  await expect
    .element(page.getByRole("textbox", { name: /Message/ }))
    .toHaveValue("Please improve this view.");
  await expect
    .element(page.getByRole("button", { name: "Send feedback", exact: true }))
    .toBeEnabled();
});
