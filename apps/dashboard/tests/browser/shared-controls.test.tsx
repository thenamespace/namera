import { useState } from "react";

import { CopyIconButton, SignInCodeInput } from "@namera-ai/ui";
import { expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

it("uses one keyboard-focusable copy trigger with an accessible tooltip", async () => {
  const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  await render(
    <>
      <button type="button">Before</button>
      <CopyIconButton label="Identity" value="example.namera.id" />
      <button type="button">After</button>
    </>,
  );

  expect(page.getByRole("button").elements()).toHaveLength(3);
  await page.getByRole("button", { name: "Before", exact: true }).click();
  await userEvent.tab();
  await expect
    .element(page.getByRole("button", { name: "Copy identity", exact: true }))
    .toHaveFocus();
  await expect.element(page.getByRole("tooltip")).toHaveTextContent("Copy identity");
  await userEvent.keyboard("{Enter}");
  await expect.poll(() => writeText.mock.calls.length).toBe(1);
  await userEvent.keyboard(" ");
  await expect.poll(() => writeText.mock.calls.length).toBe(2);
  expect(writeText.mock.calls).toEqual([["example.namera.id"], ["example.namera.id"]]);
  await userEvent.tab();
  await expect.element(page.getByRole("button", { name: "After", exact: true })).toHaveFocus();
});

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

it("copies the current prop after the identity changes", async () => {
  const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  const view = await render(<CopyIconButton label="Identity" value="first.namera.id" />);
  await page.getByLabelText("Copy identity", { exact: true }).click();
  await expect.element(page.getByLabelText("Identity copied", { exact: true })).toBeVisible();
  await view.rerender(<CopyIconButton label="Identity" value="second.namera.id" />);
  await page.getByLabelText("Identity copied", { exact: true }).click();
  expect(writeText.mock.calls).toEqual([["first.namera.id"], ["second.namera.id"]]);
});

it("reports unavailable clipboard support without claiming success", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
  try {
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
    expect(onCopySuccess).not.toHaveBeenCalled();
  } finally {
    if (descriptor) Object.defineProperty(navigator, "clipboard", descriptor);
    else Reflect.deleteProperty(navigator, "clipboard");
  }
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

it("keeps the code field disabled while a request is pending", async () => {
  const onChange = vi.fn();
  await render(<SignInCodeInput isDisabled value="12345678" onChange={onChange} />);
  const input = page.getByRole("textbox", { name: "Email sign-in code" });
  await expect.element(input).toBeDisabled();
  await expect.element(input).toHaveValue("12345678");
  expect(onChange).not.toHaveBeenCalled();
});
