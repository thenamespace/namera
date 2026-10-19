import { expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import type { PolicyChoice } from "../../src/components/session-key-creation/policies/catalog";
import { PolicyPicker } from "../../src/components/session-key-creation/policies/picker";

const available = () => undefined;
const rootUnavailable = (choice: PolicyChoice) =>
  choice.id === "root" ? "Remove other transaction policies first" : undefined;

it("groups the six choices by account access, limits, and signing", async () => {
  await render(<PolicyPicker unavailable={available} onSelect={vi.fn()} />);
  const access = page.getByRole("region", { name: "Account access", exact: true });
  const limits = page.getByRole("region", { name: "Limits", exact: true });
  const signing = page.getByRole("region", { name: "Signing", exact: true });
  await expect.element(access.getByRole("heading", { name: "Account access" })).toBeVisible();
  expect(access.getByRole("button").elements()).toHaveLength(3);
  expect(limits.getByRole("button").elements()).toHaveLength(2);
  expect(signing.getByRole("button").elements()).toHaveLength(1);
  await expect
    .element(access.getByRole("button", { name: "Configure Contract access", exact: true }))
    .toBeVisible();
  await expect
    .element(
      access.getByRole("button", { name: "Configure Unrestricted account access", exact: true }),
    )
    .toBeVisible();
  await expect
    .element(signing.getByRole("button", { name: "Configure Signatures", exact: true }))
    .toBeVisible();
});

it("searches group names, hides empty groups, and restores them when cleared", async () => {
  await render(<PolicyPicker unavailable={available} onSelect={vi.fn()} />);
  const search = page.getByRole("textbox", { name: "Search policies" });
  await search.fill("limits");
  await expect.element(page.getByRole("heading", { name: "Limits", exact: true })).toBeVisible();
  await expect
    .element(page.getByRole("heading", { name: "Account access", exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(page.getByRole("heading", { name: "Signing", exact: true }))
    .not.toBeInTheDocument();
  expect(
    page.getByRole("region", { name: "Limits", exact: true }).getByRole("button").elements(),
  ).toHaveLength(2);
  await search.fill("not-a-policy");
  await expect.element(page.getByText("No matching policies", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect
    .element(page.getByRole("heading", { name: "Account access", exact: true }))
    .toBeVisible();
  await expect.element(page.getByRole("heading", { name: "Signing", exact: true })).toBeVisible();
});

it("preserves unavailable choices and selects the original policy", async () => {
  const onSelect = vi.fn();
  await render(<PolicyPicker unavailable={rootUnavailable} onSelect={onSelect} />);
  await expect
    .element(
      page.getByRole("button", {
        name: "Remove other transaction policies first: Unrestricted account access",
        exact: true,
      }),
    )
    .toBeDisabled();
  await page.getByRole("button", { name: "Configure Contract access", exact: true }).click();
  expect(onSelect).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ id: "contract-access" }),
  );
});
