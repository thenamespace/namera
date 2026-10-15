// oxlint-disable react-perf/jsx-no-new-object-as-prop
import { Redacted, Schema } from "effect";
import { HttpApiError } from "effect/http-api";

import { CreateSessionKeyResponse, type CreateEvmSessionKeyRequest } from "@namera-ai/protocol/dto";
import type { LocalSessionKeyDraft } from "@namera-ai/sdk";
import { beforeEach, expect, it, vi } from "vitest";
import { render, renderHook } from "vitest-browser-react";
import { page } from "vitest/browser";

import { ExportSessionKey } from "../../src/components/session-key-creation/export-key";
import type { CreateSessionKeyFormValues } from "../../src/components/session-key-creation/types";
import { useSessionKeyCreation } from "../../src/components/session-key-creation/use-session-key-creation";
import type { useCreateSessionKey } from "../../src/hooks/session-key";
import { actor } from "../fixtures/actor";
import { managedWallet } from "../fixtures/wallet-transaction";

const boundary = vi.hoisted(() => ({
  mutate: vi.fn(),
  recover: vi.fn(),
  toast: vi.fn(),
  complete: vi.fn(),
}));
let callbacks: NonNullable<Parameters<typeof useCreateSessionKey>[0]>;
vi.mock("../../src/hooks/session-key", () => ({
  useCreateSessionKey: (options: typeof callbacks) => {
    callbacks = options;
    return { mutate: boundary.mutate, isPending: false };
  },
}));
vi.mock("../../src/hooks/session-key/recover-registration", () => ({
  useRecoverSessionRegistration: () => boundary.recover,
}));
vi.mock("../../src/hooks/use-provisioning-request", () => ({
  useProvisioningRequest: () => ({ complete: boundary.complete }),
}));
vi.mock("../../src/lib/toasts", () => ({
  showErrorToast: boundary.toast,
  showSuccessToast: vi.fn(),
}));
vi.mock("../../src/env", () => ({ env: { backendUrl: "https://api.example.test" } }));
vi.mock("@tanstack/react-router", () => ({ useBlocker: () => ({ status: "idle" }) }));

const input: CreateSessionKeyFormValues = {
  custody: "local",
  namespace: "eip155",
  walletId: managedWallet.id,
  metadata: { version: 1, name: "Local trading key" },
  policies: [],
  onchain: {
    installations: [
      {
        chainId: "eip155:1",
        validAfter: 0,
        validUntil: 2_000_000_000,
        permissions: [{ type: "root" }],
        allowSignatures: false,
      },
    ],
  },
};

async function registerLocalKey() {
  const hook = await renderHook(() => useSessionKeyCreation([managedWallet]));
  await hook.act(() => hook.result.current.submit(input));
  const request: CreateEvmSessionKeyRequest = boundary.mutate.mock.calls[0]?.[0].payload;
  if (request.signer.custody !== "local") throw new Error("Expected local registration");
  const { publicKeyToAddress } = await import("viem/accounts");
  const registration = Schema.decodeUnknownSync(Schema.toType(CreateSessionKeyResponse))({
    id: "01950000-0000-7000-8000-000000000006",
    walletId: managedWallet.id,
    organizationId: managedWallet.organizationId,
    signingKeyId: "01950000-0000-7000-8000-000000000007",
    namespace: "eip155",
    metadata: request.metadata,
    signer: request.signer,
    policies: [],
    policyHash: "fixture",
    status: "pending",
    revokedAt: null,
    createdAt: managedWallet.createdAt,
    wallet: managedWallet,
    creator: actor.member,
    installations: [
      {
        id: "01950000-0000-7000-8000-000000000008",
        chainId: "eip155:1",
        status: "pending",
        authorization: {
          version: 1,
          entityId: 7,
          signerAddress: publicKeyToAddress(request.signer.publicKey),
          ...input.onchain.installations[0],
        },
        installTransactionHash: null,
        uninstallTransactionHash: null,
      },
    ],
  });
  return { hook, request, registration };
}

beforeEach(() => {
  Object.values(boundary).forEach((mock) => mock.mockReset());
  boundary.recover.mockResolvedValue([]);
});

it("reveals export only for matching registration and disposes the key after backup acknowledgement", async () => {
  const { hook, request, registration } = await registerLocalKey();
  expect(hook.result.current.setup).toBeUndefined();
  expect(hook.result.current.needsBackup).toBe(true);
  await hook.act(async () => callbacks.onSuccess?.(registration, { payload: request }));
  const setup = hook.result.current.setup;
  expect(setup?.bindings[0]?.sessionKeyId).toBe(registration.id);
  if (!setup) throw new Error("Missing validated export");
  await hook.act(() => hook.result.current.acknowledgeBackup());
  expect(hook.result.current.needsBackup).toBe(false);
  await expect(
    setup.draft.seal("https://api.example.test", setup.bindings, Redacted.make("test passphrase")),
  ).rejects.toMatchObject({ code: "DRAFT_DISPOSED" });
});

it("rejects a registration with different permissions without exposing an export", async () => {
  const { hook, request, registration } = await registerLocalKey();
  const mismatch = {
    ...registration,
    installations: Array.from(registration.installations, (installation) => ({
      ...installation,
      authorization: { ...installation.authorization, allowSignatures: true },
    })),
  };
  await hook.act(async () => callbacks.onSuccess?.(mismatch, { payload: request }));
  expect(hook.result.current.registrationError).toBe(true);
  expect(hook.result.current.setup).toBeUndefined();
  expect(boundary.toast).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ title: "Session configuration does not match" }),
  );
});

it("disposes validated drafts on navigation", async () => {
  const { hook, request, registration } = await registerLocalKey();
  await hook.act(async () => callbacks.onSuccess?.(registration, { payload: request }));
  const setup = hook.result.current.setup;
  if (!setup) throw new Error("Missing validated export");
  await hook.unmount();
  await callbacks.onSuccess?.(registration, { payload: request });
  await expect(
    setup.draft.seal("https://api.example.test", setup.bindings, Redacted.make("test passphrase")),
  ).rejects.toMatchObject({ code: "DRAFT_DISPOSED" });
});

it("does not expose a registration that completes after navigation", async () => {
  const { hook, request, registration } = await registerLocalKey();
  expect(hook.result.current.setup).toBeUndefined();
  await hook.unmount();
  await callbacks.onSuccess?.(registration, { payload: request });
  expect(hook.result.current.setup).toBeUndefined();
  expect(hook.result.current.registration).toBeUndefined();
});

it("keeps a failed registration unavailable for export while retaining the same signer for retry", async () => {
  const { hook, request } = await registerLocalKey();
  await hook.act(async () => {
    await callbacks.onError?.(new HttpApiError.InternalServerError(), { payload: request });
    await callbacks.onSettled?.(undefined, null, { payload: request });
  });
  expect(hook.result.current.setup).toBeUndefined();
  await hook.act(() => hook.result.current.submit(input));
  expect(boundary.mutate.mock.calls[1]?.[0].payload.signer).toEqual(request.signer);
});

it("exports encrypted material only after matching passphrases and requires import acknowledgement", async () => {
  const { hook, request, registration } = await registerLocalKey();
  await hook.act(async () => callbacks.onSuccess?.(registration, { payload: request }));
  const setup = hook.result.current.setup;
  if (!setup) throw new Error("Missing validated export");
  const encrypted = vi.fn();
  const saved = vi.fn();
  const seal = vi.fn<LocalSessionKeyDraft["seal"]>(setup.draft.seal);
  const draft = { ...setup.draft, seal };
  const view = await render(
    <ExportSessionKey
      draft={draft}
      bindings={setup.bindings}
      onEncrypted={encrypted}
      onSaved={saved}
    />,
  );
  await page.getByLabelText("Export passphrase", { exact: true }).fill("test passphrase");
  await page.getByLabelText("Confirm passphrase").fill("wrong passphrase");
  await page.getByRole("button", { name: "Encrypt and continue" }).click();
  expect(seal).not.toHaveBeenCalled();
  await page.getByLabelText("Confirm passphrase").fill("test passphrase");
  await page.getByRole("button", { name: "Encrypt and continue" }).click();
  await expect
    .element(page.getByRole("button", { name: "Confirm import and continue" }))
    .toBeDisabled();
  expect(seal).toHaveBeenCalledOnce();
  expect(encrypted).toHaveBeenCalledOnce();
  expect(saved).not.toHaveBeenCalled();
  await expect
    .element(page.getByLabelText("Export passphrase", { exact: true }))
    .not.toBeInTheDocument();
  await page.getByText("The CLI confirmed my key was imported successfully.").click();
  await page.getByRole("button", { name: "Confirm import and continue" }).click();
  expect(saved).toHaveBeenCalledOnce();
  await view.unmount();
});
