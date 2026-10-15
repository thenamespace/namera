// oxlint-disable react-perf/jsx-no-new-object-as-prop
import type { ReactNode } from "react";

import { RegistryContext } from "@effect/atom-react";
import { Layer, Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import { AtomRegistry } from "effect/reactivity";

import { ImportCatalogResponse } from "@namera-ai/protocol/dto";
import { PlatformMember, PlatformMemberView, WaitlistEntry } from "@namera-ai/protocol/model";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import { ImportCatalogDialog } from "../../src/routes/_authenticated/-components/catalog/import-dialog";
import { CreateInvitesDialog } from "../../src/routes/_authenticated/-components/invites/create-dialog";
import { MemberDialog } from "../../src/routes/_authenticated/-components/team/member-dialog";
import { AcceptWaitlistDialog } from "../../src/routes/_authenticated/-components/waitlist/accept-dialog";
import { adminRuntime } from "../../src/telemetry";
import { adminResponse } from "../fixtures/admin";
import { unexpectedRequests } from "./setup";

adminRuntime.addGlobalLayer(
  Layer.succeed(FetchHttpClient.Fetch)((...args) => globalThis.fetch(...args)),
);

const registries: AtomRegistry.AtomRegistry[] = [];
const pendingResponses: Array<() => void> = [];
const requestTargets: Array<{ expected: string; actual: string }> = [];
afterEach(async () => {
  await cleanup();
  for (const registry of registries.splice(0)) registry.dispose();
  for (const finish of pendingResponses.splice(0)) finish();
  for (const target of requestTargets.splice(0)) expect(target.actual).toBe(target.expected);
});

async function renderDialog(dialog: ReactNode) {
  const registry = AtomRegistry.make();
  registries.push(registry);
  return render(<RegistryContext.Provider value={registry}>{dialog}</RegistryContext.Provider>);
}

function pendingRequest(path: string, method = "POST") {
  let finish!: (response: Response) => void;
  const response = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  pendingResponses.push(() => finish(json({ _tag: "InternalServerError" }, 500)));
  const fetch = vi.fn<typeof globalThis.fetch>().mockReturnValue(response);
  vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
    const actual = `${init?.method ?? "GET"} ${new URL(String(input)).pathname}`;
    if (actual === "GET /internal/me") return json(adminResponse([]));
    const expected = `${method} ${path}`;
    requestTargets.push({ expected, actual });
    if (actual !== expected) unexpectedRequests.push(actual);
    return fetch(input, init);
  });
  return { fetch, finish };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function requestBody() {
  const call = vi.mocked(fetch).mock.calls.findLast(([, init]) => init?.method === "POST");
  return JSON.parse(new TextDecoder().decode(call?.[1]?.body as Uint8Array));
}

it("clears individual email when switching to a batch and retains the draft after failure", async () => {
  const request = pendingRequest("/internal/invites");
  const close = vi.fn();
  await renderDialog(<CreateInvitesDialog onClose={close} />);
  await page.getByLabelText("Email address (optional)").fill("person@example.com");
  await page.getByLabelText("Number of codes").fill("2");
  await page.getByRole("button", { name: "Create invite codes", exact: true }).click();
  await expect.poll(() => request.fetch.mock.calls.length).toBe(1);
  expect(requestBody()).toEqual({ count: 2, expiresInDays: 7 });
  await expect.element(page.getByRole("button", { name: "Creating…" })).toBeDisabled();
  await userEvent.keyboard("{Escape}");
  expect(close).not.toHaveBeenCalled();

  request.finish(json({ _tag: "InternalServerError" }, 500));
  await expect
    .element(page.getByRole("button", { name: "Create invite codes", exact: true }))
    .toBeEnabled();
  await expect.element(page.getByLabelText("Number of codes")).toHaveValue(2);
  await page.getByLabelText("Number of codes").fill("1");
  await expect.element(page.getByLabelText("Email address (optional)")).toHaveValue("");
  expect(request.fetch).toHaveBeenCalledOnce();
});

it("reveals returned invite codes once and clears them on unmount", async () => {
  const request = pendingRequest("/internal/invites");
  const close = vi.fn();
  const screen = await renderDialog(<CreateInvitesDialog onClose={close} />);
  await page.getByRole("button", { name: "Create invite code", exact: true }).click();
  await expect.poll(() => request.fetch.mock.calls.length).toBe(1);
  request.finish(
    json({
      invites: [
        {
          id: "invite-test",
          code: "ABC234",
          url: "https://app.example.test/join?code=ABC234",
          expiresAt: "2026-10-22T00:00:00Z",
        },
      ],
    }),
  );
  await expect.element(page.getByText("ABC234", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  expect(close).toHaveBeenCalledOnce();
  await screen.unmount();
  await renderDialog(<CreateInvitesDialog onClose={close} />);
  await expect
    .element(page.getByRole("button", { name: "Create invite code", exact: true }))
    .toBeEnabled();
  await expect.element(page.getByText("ABC234", { exact: true })).not.toBeInTheDocument();
  expect(request.fetch).toHaveBeenCalledOnce();
});

it("retains a team invitation after rejection and disables submission while pending", async () => {
  const request = pendingRequest("/internal/member-invitations");
  const close = vi.fn();
  const state = { type: "invite" } as const;
  await renderDialog(<MemberDialog state={state} onClose={close} />);
  await page.getByLabelText("Email address", { exact: true }).fill("operator@example.com");
  await page.getByRole("button", { name: "Send invite", exact: true }).click();
  await expect.poll(() => request.fetch.mock.calls.length).toBe(1);
  expect(requestBody()).toEqual({ email: "operator@example.com", role: "viewer" });
  await expect.element(page.getByRole("button", { name: "Sending…" })).toBeDisabled();
  request.finish(json({ _tag: "InternalServerError" }, 500));
  await expect
    .element(page.getByRole("button", { name: "Send invite", exact: true }))
    .toBeEnabled();
  await expect
    .element(page.getByLabelText("Email address", { exact: true }))
    .toHaveValue("operator@example.com");
  expect(close).not.toHaveBeenCalled();
});

it("accepts only the reviewed waitlist entry and closes only after success", async () => {
  const id = "01900000-0000-7000-8000-000000000001";
  const request = pendingRequest(`/internal/waitlist/${id}/accept`);
  const entry = Schema.decodeUnknownSync(WaitlistEntry)({
    id,
    email: "waiting@example.com",
    status: "pending",
    createdAt: new Date("2026-10-01T00:00:00Z"),
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    completedAt: null,
  });
  const close = vi.fn();
  await renderDialog(<AcceptWaitlistDialog entry={entry} onClose={close} />);
  await expect.element(page.getByText("waiting@example.com", { exact: true })).toBeVisible();
  expect(request.fetch).not.toHaveBeenCalled();
  await page.getByRole("button", { name: "Accept and send invite" }).click();
  await expect.poll(() => request.fetch.mock.calls.length).toBe(1);
  await expect.element(page.getByRole("button", { name: "Accepting…" })).toBeDisabled();
  expect(close).not.toHaveBeenCalled();
  request.finish(json({ accepted: true }));
  await expect.poll(() => close.mock.calls.length).toBe(1);
});

it("removes the reviewed admin member only after confirmation", async () => {
  const member = Schema.decodeUnknownSync(PlatformMemberView)({
    id: "member-to-remove",
    userId: "01900000-0000-7000-8000-000000000001",
    role: "viewer",
    status: "active",
    email: "viewer@example.com",
    metadata: { version: 1 },
    createdAt: new Date("2026-10-01T00:00:00Z"),
    updatedAt: new Date("2026-10-01T00:00:00Z"),
  });
  const request = pendingRequest(`/internal/members/${member.id}`, "DELETE");
  const close = vi.fn();
  const state = { type: "remove", member } as const;
  await renderDialog(<MemberDialog state={state} onClose={close} />);
  await expect
    .element(page.getByText(/Remove viewer@example.com from the admin team/))
    .toBeVisible();
  expect(request.fetch).not.toHaveBeenCalled();
  await page.getByRole("button", { name: "Remove member", exact: true }).click();
  await expect.poll(() => request.fetch.mock.calls.length).toBe(1);
  expect(request.fetch.mock.calls[0]?.[1]?.method).toBe("DELETE");
  await expect.element(page.getByRole("button", { name: "Removing…" })).toBeDisabled();
  request.finish(
    json(Schema.encodeSync(Schema.toCodecJson(PlatformMember))({ ...member, status: "removed" })),
  );
  await expect.poll(() => close.mock.calls.length).toBe(1);
});

it("requires catalog review before import and retains the reviewed payload after failure", async () => {
  const upload = { version: 1, catalog: [], entries: [], interfaces: [] };
  const counts = { created: 0, updated: 0, unchanged: 0 };
  const request = pendingRequest("/internal/catalog/import");
  const close = vi.fn();
  await renderDialog(<ImportCatalogDialog onClose={close} />);
  await userEvent.upload(
    page.getByLabelText("Catalog file"),
    new File([JSON.stringify(upload)], "catalog.json", { type: "application/json" }),
  );
  expect(request.fetch).not.toHaveBeenCalled();
  await page.getByRole("button", { name: "Review changes" }).click();
  await expect.poll(() => request.fetch.mock.calls.length).toBe(1);
  expect(String(request.fetch.mock.calls[0]?.[0])).toContain("dryRun=true");
  expect(requestBody()).toEqual(upload);
  request.finish(
    json(
      Schema.decodeUnknownSync(ImportCatalogResponse)({
        dryRun: true,
        catalog: counts,
        entries: counts,
        interfaces: counts,
      }),
    ),
  );
  await expect
    .element(page.getByRole("button", { name: "Import catalog", exact: true }))
    .toBeEnabled();
  request.fetch.mockImplementation(async () => json({ _tag: "InternalServerError" }, 500));
  await page.getByRole("button", { name: "Import catalog", exact: true }).click();
  await expect.element(page.getByRole("alert")).toBeVisible();
  expect(String(request.fetch.mock.calls[1]?.[0])).toContain("dryRun=false");
  expect(requestBody()).toEqual(upload);
  await expect.element(page.getByText("Ready to import", { exact: true })).toBeVisible();
  expect(close).not.toHaveBeenCalled();
});
