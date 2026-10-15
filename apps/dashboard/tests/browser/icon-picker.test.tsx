import { IconPicker } from "@namera-ai/ui/icon-picker";
import { expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

const icon = { type: "icon", value: "home-01", color: "#f7f8f8" } as const;
const supportedTypes = ["icon"] as const;

it("opens from the keyboard, clears search, and commits only an explicitly selected icon", async () => {
  const select = vi.fn();
  await render(<IconPicker value={icon} setValue={select} supportedTypes={supportedTypes} />);
  await userEvent.tab();
  await expect
    .element(page.getByRole("button", { name: "Choose icon", exact: true }))
    .toHaveFocus();
  await userEvent.keyboard("{Enter}");
  await expect.element(page.getByRole("dialog")).toBeVisible();
  await expect.element(page.getByRole("dialog")).toHaveAccessibleName("Choose icon");
  const search = page.getByRole("searchbox", { name: "Search icons", exact: true });
  await search.fill("no-matching-icon");
  await expect
    .element(page.getByRole("button", { name: "Home 01", exact: true }))
    .not.toBeInTheDocument();
  await page.getByRole("button", { name: "Clear icon search", exact: true }).click();
  await expect.element(search).toHaveValue("");
  await expect.element(page.getByRole("button", { name: "Home 01", exact: true })).toBeVisible();
  await search.fill("bitcoin");
  const bitcoin = page.getByRole("button", { name: "Bitcoin", exact: true });
  await expect.element(bitcoin).toBeVisible();
  expect(select).not.toHaveBeenCalled();
  bitcoin.element().focus();
  await userEvent.keyboard("{Enter}");
  expect(select).toHaveBeenCalledExactlyOnceWith({
    type: "icon",
    value: "bitcoin",
    color: icon.color,
  });
  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
});

it("discards search changes on dismissal without changing the selected icon", async () => {
  const select = vi.fn();
  await render(<IconPicker value={icon} setValue={select} supportedTypes={supportedTypes} />);
  await page.getByRole("button", { name: "Choose icon", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search icons", exact: true }).fill("bitcoin");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  expect(select).not.toHaveBeenCalled();
  await page.getByRole("button", { name: "Choose icon", exact: true }).click();
  await expect
    .element(page.getByRole("button", { name: "Home 01", exact: true }))
    .toHaveAttribute("aria-pressed", "true");
});
