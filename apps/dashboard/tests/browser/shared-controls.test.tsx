import { useState } from "react";

import { CopyIconButton, SignInCodeInput } from "@namera-ai/ui";
import { expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

it("copies the provided value and announces success", async () => {
  const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  const onCopySuccess = vi.fn();
  const onCopyError = vi.fn();
  await render(
    <CopyIconButton
      label="Identity"
      value="example.namera.id"
      onCopySuccess={onCopySuccess}
      onCopyError={onCopyError}
    />,
  );

  await page.getByLabelText("Copy identity", { exact: true }).click();
  await expect.element(page.getByLabelText("Identity copied", { exact: true })).toBeVisible();
  expect(writeText).toHaveBeenCalledExactlyOnceWith("example.namera.id");
  expect(onCopySuccess).toHaveBeenCalledOnce();
  expect(onCopyError).not.toHaveBeenCalled();
});

it("reports denied clipboard access without claiming success", async () => {
  vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
    new DOMException("Denied", "NotAllowedError"),
  );
  const onCopyError = vi.fn();
  const onCopySuccess = vi.fn();
  await render(
    <CopyIconButton
      label="Identity"
      value="example.namera.id"
      onCopyError={onCopyError}
      onCopySuccess={onCopySuccess}
    />,
  );

  await page.getByLabelText("Copy identity", { exact: true }).click();
  await expect.poll(() => onCopyError.mock.calls.length).toBe(1);
  await expect.element(page.getByLabelText("Copy identity", { exact: true })).toBeVisible();
  expect(onCopySuccess).not.toHaveBeenCalled();
});

function CodeForm() {
  const [code, setCode] = useState("");
  return <SignInCodeInput value={code} onChange={setCode} />;
}

it("accepts an eight-digit email code and rejects non-digit replacement", async () => {
  await render(<CodeForm />);
  const input = page.getByRole("textbox", { name: "Email sign-in code" });
  await input.fill("12345678");
  await expect.element(input).toHaveValue("12345678");
  await input.fill("abcdefgh");
  await expect.element(input).toHaveValue("12345678");
  await expect.element(input).toHaveAttribute("maxlength", "8");
});
