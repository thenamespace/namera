// oxlint-disable react-perf/jsx-no-new-array-as-prop
import { Schema } from "effect";

import { CreateApiKeyResponse, SessionKeyResponse } from "@namera-ai/protocol/dto";
import { beforeEach, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import type { useCreateApiKey } from "../../src/hooks/api-key";
import { CreateApiKeyDialog } from "../../src/routes/_authenticated/settings/-components/api-keys-table/create-api-key-dialog";
import { MemberActions } from "../../src/routes/_authenticated/settings/-components/members-table/member-actions";
import { actor } from "../fixtures/actor";
import { managedWallet } from "../fixtures/wallet-transaction";

const boundary = vi.hoisted(() => ({
  pending: false,
  create: vi.fn(),
  reset: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
  clipboard: vi.fn(),
  toast: vi.fn(),
}));
let createCallbacks: NonNullable<Parameters<typeof useCreateApiKey>[0]>;
vi.mock("../../src/hooks/api-key", () => ({
  useCreateApiKey: (callbacks: typeof createCallbacks) => {
    createCallbacks = callbacks;
    return { mutate: boundary.create, reset: boundary.reset, isPending: boundary.pending };
  },
}));
vi.mock("../../src/hooks/session-key", () => ({ useSessionKeys: () => ({ data: undefined }) }));
vi.mock("../../src/hooks/auth", () => ({
  useCurrentUser: () => ({
    data: {
      ...actor,
      role: {
        ...actor.role,
        permissions: [
          "member:remove",
          "member:update",
          "wallet:read",
          "wallet:create",
          "session-key:read",
          "session-key:create",
        ],
      },
    },
  }),
  useRemoveMember: () => ({ mutate: boundary.remove, isPending: false }),
  useUpdateMemberRole: () => ({ mutate: boundary.update, isPending: false }),
}));
vi.mock("../../src/lib/clipboard", () => ({
  writeClipboardText: boundary.clipboard,
  copyTextWithFeedback: boundary.clipboard,
}));
vi.mock("../../src/lib/toasts", () => ({
  showErrorToast: boundary.toast,
  showSuccessToast: vi.fn(),
}));
vi.mock("../../src/env", () => ({
  env: { backendUrl: "https://api.example.test", environment: "test" },
}));

const session = Schema.decodeUnknownSync(Schema.toType(SessionKeyResponse))({
  id: "01950000-0000-7000-8000-000000000006",
  organizationId: managedWallet.organizationId,
  walletId: managedWallet.id,
  signingKeyId: "01950000-0000-7000-8000-000000000007",
  namespace: "eip155",
  metadata: { version: 1, name: "Trading access" },
  policies: [],
  policyHash: "fixture",
  status: "active",
  revokedAt: null,
  createdAt: managedWallet.createdAt,
  signer: { custody: "local", algorithm: "secp256k1", publicKey: `0x04${"11".repeat(64)}` },
  wallet: managedWallet,
  creator: actor.member,
  installations: [],
});
const created = Schema.decodeUnknownSync(Schema.toType(CreateApiKeyResponse))({
  key: "namera-test-one-time-secret",
  apiKey: {
    id: "01950000-0000-7000-8000-000000000009",
    organizationId: actor.organization.id,
    actorId: actor.actorId,
    metadata: { version: 1, name: "Trading agent" },
    permissions: [],
    passkeyOrigins: [],
    keyStart: "namera-test",
    expiresAt: null,
    lastUsedAt: null,
    revokedAt: null,
    sessionKeys: [],
    creator: actor.member,
    createdAt: managedWallet.createdAt,
    updatedAt: managedWallet.updatedAt,
  },
});
const initialSessionKeys = [session];

beforeEach(() => {
  Object.values(boundary).forEach((mock) => {
    if (typeof mock === "function") mock.mockReset();
  });
  boundary.pending = false;
  boundary.clipboard.mockResolvedValue(true);
});

async function fillApiKeyForm() {
  await page.getByRole("button", { name: "Create API key", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabelText("Name", { exact: true }).fill("Trading agent");
  await dialog.getByRole("button", { name: /Accounts and session keys/ }).click();
  await page.getByRole("option", { name: /Trading access/ }).click();
  await userEvent.keyboard("{Escape}");
  await dialog.getByRole("button", { name: "Create API key", exact: true }).click();
}

it("reveals the created API key once, then clears secret and draft when dismissed", async () => {
  await render(<CreateApiKeyDialog initialSessionKeys={initialSessionKeys} />);
  await fillApiKeyForm();
  expect(boundary.create).toHaveBeenCalledExactlyOnceWith({
    payload: {
      metadata: { version: 1, name: "Trading agent", logo: { type: "emoji", value: "🔐" } },
      durationDays: 30,
      sessionKeyIds: [session.id],
      permissions: [],
      passkeyOrigins: [],
    },
  });
  const variables = boundary.create.mock.calls[0]?.[0];
  await createCallbacks.onSuccess?.(created, variables);
  await expect.element(page.getByText(created.key, { exact: true })).toBeVisible();
  expect(boundary.clipboard).toHaveBeenCalledWith(created.key);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  await page.getByRole("button", { name: "Create API key", exact: true }).click();
  await expect.element(page.getByText(created.key, { exact: true })).not.toBeInTheDocument();
  await expect.element(page.getByLabelText("Name", { exact: true })).toHaveValue("");
  expect(boundary.reset).toHaveBeenCalledOnce();
});

it("does not reveal a credential or clear the draft after creation failure", async () => {
  await render(<CreateApiKeyDialog initialSessionKeys={initialSessionKeys} />);
  await fillApiKeyForm();
  const { HttpApiError } = await import("effect/http-api");
  await createCallbacks.onError?.(
    new HttpApiError.InternalServerError(),
    boundary.create.mock.calls[0]?.[0],
  );
  await expect.element(page.getByLabelText("Name", { exact: true })).toHaveValue("Trading agent");
  await expect.element(page.getByRole("button", { name: "Copy API key" })).not.toBeInTheDocument();
  expect(boundary.clipboard).not.toHaveBeenCalled();
  expect(boundary.toast).toHaveBeenCalledOnce();
});

it.each(["dismiss", "navigate"] as const)("ignores late API-key success after %s", async (exit) => {
  const view = await render(<CreateApiKeyDialog initialSessionKeys={initialSessionKeys} />);
  await fillApiKeyForm();
  const variables = boundary.create.mock.calls[0]?.[0];
  if (exit === "navigate") await view.unmount();
  else await userEvent.keyboard("{Escape}");
  await createCallbacks.onSuccess?.(created, variables);
  expect(boundary.clipboard).not.toHaveBeenCalled();
  if (exit === "dismiss") {
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    await page.getByRole("button", { name: "Create API key", exact: true }).click();
    await expect.element(page.getByText(created.key, { exact: true })).not.toBeInTheDocument();
  }
});

it("keeps a pending API-key creation open until its response can be saved", async () => {
  const view = await render(<CreateApiKeyDialog initialSessionKeys={initialSessionKeys} />);
  await fillApiKeyForm();
  boundary.pending = true;
  await view.rerender(<CreateApiKeyDialog initialSessionKeys={initialSessionKeys} />);
  await userEvent.keyboard("{Escape}");
  await expect.element(page.getByRole("dialog")).toBeVisible();
  await expect.element(page.getByRole("button", { name: "Creating…", exact: true })).toBeDisabled();
  boundary.pending = false;
  await createCallbacks.onSuccess?.(created, boundary.create.mock.calls[0]?.[0]);
  await expect.element(page.getByText(created.key, { exact: true })).toBeVisible();
});

it("confirms removal of the selected member, not the current actor or another row", async () => {
  const target = Schema.decodeUnknownSync(
    Schema.toType(CreateApiKeyResponse.fields.apiKey.fields.creator),
  )({
    ...actor.member,
    user: {
      ...actor.user,
      id: "01950000-0000-7000-8000-000000000011",
      metadata: { version: 1, name: "Target member" },
    },
    organizationMember: {
      ...actor.member.organizationMember,
      id: "01950000-0000-7000-8000-000000000012",
      userId: "01950000-0000-7000-8000-000000000011",
    },
  });
  const roles = [actor.role];
  await render(
    <>
      <MemberActions member={actor.member} assignableRoles={roles} />
      <MemberActions member={target} assignableRoles={roles} />
    </>,
  );
  await page.getByRole("button", { name: "Actions for Target member" }).click();
  await page.getByRole("menuitem", { name: "Remove member" }).click();
  await expect
    .element(
      page.getByText(
        "Remove Target member from this organization? Their active access will be revoked.",
      ),
    )
    .toBeVisible();
  expect(boundary.remove).not.toHaveBeenCalled();
  await page.getByRole("dialog").getByRole("button", { name: "Remove member" }).click();
  expect(boundary.remove).toHaveBeenCalledExactlyOnceWith({
    payload: { organizationMemberId: target.organizationMember.id },
  });
  expect(boundary.update).not.toHaveBeenCalled();
});

it("creates a management-only key and disables permissions the issuer cannot delegate", async () => {
  await render(<CreateApiKeyDialog initialSessionKeys={[]} />);
  await page.getByRole("button", { name: "Create API key", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabelText("Name", { exact: true }).fill("Workspace backend");
  await expect.element(dialog.getByLabelText("Passkey application origins")).not.toBeVisible();
  await dialog.getByText("Advanced", { exact: true }).click();
  await dialog.getByText("Create accounts", { exact: true }).click();
  await expect
    .element(
      dialog.getByRole("checkbox", { name: "Manage session key installations", exact: true }),
    )
    .toBeDisabled();
  await dialog
    .getByLabelText("Passkey application origins")
    .fill("https://app.example.com\nhttps://other.example.com");
  await dialog.getByRole("button", { name: "Create API key", exact: true }).click();
  expect(boundary.create).toHaveBeenCalledWith({
    payload: {
      metadata: { version: 1, name: "Workspace backend", logo: { type: "emoji", value: "🔐" } },
      durationDays: 30,
      sessionKeyIds: [],
      permissions: ["wallet:read", "wallet:create"],
      passkeyOrigins: ["https://app.example.com", "https://other.example.com"],
    },
  });
});

it("preserves session-key read access when another management group is cleared", async () => {
  await render(<CreateApiKeyDialog initialSessionKeys={[]} />);
  await page.getByRole("button", { name: "Create API key", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabelText("Name", { exact: true }).fill("Session provisioning");
  await dialog.getByText("Advanced", { exact: true }).click();
  await dialog.getByText("Create accounts", { exact: true }).click();
  await dialog.getByText("Create session keys", { exact: true }).click();
  await dialog.getByText("Create accounts", { exact: true }).click();
  await expect
    .element(dialog.getByRole("checkbox", { name: "Create session keys", exact: true }))
    .toBeChecked();
  await dialog.getByRole("button", { name: "Create API key", exact: true }).click();
  expect(boundary.create).toHaveBeenCalledWith({
    payload: {
      metadata: { version: 1, name: "Session provisioning", logo: { type: "emoji", value: "🔐" } },
      durationDays: 30,
      sessionKeyIds: [],
      permissions: ["wallet:read", "session-key:read", "session-key:create"],
      passkeyOrigins: [],
    },
  });
});
