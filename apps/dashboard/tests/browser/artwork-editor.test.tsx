import { useState } from "react";

import { EnsLabel } from "@namera-ai/protocol";
import { beforeEach, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { ArtworkEditor } from "../../src/routes/_authenticated/identity/-components/artwork-editor";
import { managedWallet } from "../fixtures/wallet-transaction";

const boundary = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("../../src/env", () => ({ env: { backendUrl: "https://api.example.test" } }));
vi.mock("../../src/routes/_authenticated/identity/-components/use-artwork-save", () => ({
  useArtworkSave: () => ({
    run: boundary.run,
    progress: null,
    ready: true,
    approvalError: false,
    retryApproval: vi.fn(),
  }),
}));

const pixel = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const texts = { avatar: pixel, header: pixel };

function Editor() {
  const [actions, setActions] = useState<HTMLDivElement | null>(null);
  return (
    <>
      <ArtworkEditor
        wallet={managedWallet}
        label={EnsLabel.make("example")}
        texts={texts}
        name="example.namera.id"
        actionsContainer={actions}
      />
      <div ref={setActions} />
    </>
  );
}

async function selectImage(kind: "avatar" | "header", name: string) {
  const input = document.querySelector<HTMLInputElement>(`input[name="${kind}"]`);
  if (!input) throw new Error(`Missing ${kind} picker`);
  const file = new File(["image content"], name, { type: "image/png" });
  await page.elementLocator(input).upload(file);
  return file;
}

beforeEach(() => {
  boundary.run.mockReset().mockResolvedValue(false);
});

it("releases replaced, discarded, and unmounted previews without uploading", async () => {
  const create = vi.spyOn(URL, "createObjectURL");
  const revoke = vi.spyOn(URL, "revokeObjectURL");
  const view = await render(<Editor />);

  await selectImage("avatar", "first.png");
  await expect.poll(() => create.mock.results.length).toBe(1);
  const first = create.mock.results[0]?.value;
  await expect
    .element(page.getByLabelText("example.namera.id avatar").element().querySelector("img"))
    .toHaveAttribute("src", first);
  await selectImage("avatar", "second.png");
  await expect.poll(() => revoke.mock.calls).toContainEqual([first]);
  const second = create.mock.results[1]?.value;
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect.poll(() => revoke.mock.calls).toContainEqual([second]);
  await expect
    .element(page.getByRole("button", { name: "Save", exact: true }))
    .not.toBeInTheDocument();

  await selectImage("header", "header.png");
  await expect.poll(() => create.mock.results.length).toBe(3);
  const header = create.mock.results[2]?.value;
  await view.unmount();
  expect(revoke).toHaveBeenCalledWith(header);
  expect(boundary.run).not.toHaveBeenCalled();
});

it("requires review confirmation and retains selected files after a failed save", async () => {
  await render(<Editor />);
  await selectImage("avatar", "avatar.png");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect.element(page.getByRole("dialog")).toHaveAccessibleName("Review avtr.cc upload");
  expect(boundary.run).not.toHaveBeenCalled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  await expect.element(page.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
  expect(boundary.run).not.toHaveBeenCalled();

  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Confirm and save", exact: true }).click();
  await expect.poll(() => boundary.run.mock.calls.length).toBe(1);
  expect(boundary.run).toHaveBeenCalledWith({
    avatar: expect.objectContaining({ name: "avatar.png" }),
    header: null,
  });
  await expect.element(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect.element(page.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
});
