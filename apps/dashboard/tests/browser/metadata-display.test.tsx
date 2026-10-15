import { MetadataDisplay } from "@namera-ai/ui/metadata-display";
import { expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

const absent = {};
const named = { name: "Workspace", logo: { type: "emoji", value: "🏢" } as const };
const withImage = { ...named, image: { type: "emoji", value: "🌐" } as const };

it("uses fallback metadata and prefers an explicit image over the legacy logo", async () => {
  const view = await render(<MetadataDisplay metadata={absent} fallbackName="Account" />);
  await expect.element(page.getByText("Account", { exact: true })).toBeVisible();
  await expect
    .element(page.getByText("👤", { exact: true }))
    .toHaveAttribute("aria-hidden", "true");
  await view.rerender(<MetadataDisplay metadata={named} fallbackName="Account" />);
  await expect.element(page.getByText("Workspace", { exact: true })).toBeVisible();
  await expect.element(page.getByText("🏢", { exact: true })).toBeVisible();
  await view.rerender(<MetadataDisplay metadata={withImage} fallbackName="Account" />);
  await expect.element(page.getByText("🌐", { exact: true })).toBeVisible();
  await expect.element(page.getByText("🏢", { exact: true })).not.toBeInTheDocument();
});
