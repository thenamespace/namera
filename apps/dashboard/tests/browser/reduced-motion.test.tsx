import { TransitionWrapper } from "@namera-ai/ui/transition";
import type * as Motion from "motion/react";
import { expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

vi.mock("motion/react", async (importOriginal) => {
  const motion = await importOriginal<typeof Motion>();
  return { ...motion, useReducedMotion: () => true };
});

it("presents changed steps without a hidden or translated entrance when motion is reduced", async () => {
  const view = await render(
    <TransitionWrapper stepKey="review">
      <p>Review</p>
    </TransitionWrapper>,
  );
  const first = page.getByText("Review", { exact: true }).element().parentElement;
  expect(first).toHaveStyle({ opacity: "1" });
  expect(first).not.toHaveStyle({ transform: "translateY(6px)" });
  await view.rerender(
    <TransitionWrapper stepKey="complete">
      <p>Complete</p>
    </TransitionWrapper>,
  );
  await expect.element(page.getByText("Complete", { exact: true })).toBeVisible();
  await expect.element(page.getByText("Review", { exact: true })).not.toBeInTheDocument();
  const next = page.getByText("Complete", { exact: true }).element().parentElement;
  expect(next).toHaveStyle({ opacity: "1" });
  expect(next).not.toHaveStyle({ transform: "translateY(6px)" });
});
