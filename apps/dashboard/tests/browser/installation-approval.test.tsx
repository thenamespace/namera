import { Schema } from "effect";

import {
  GetWalletPasskeyOwnerResponse,
  PasskeyAuthenticationResponse,
  PrepareSessionKeyOperationResponse,
  PrepareManagedSessionKeyOperationResponse,
  SessionKeyResponse,
  WalletResponse,
} from "@namera-ai/protocol/dto";
import { beforeEach, expect, it, vi } from "vitest";
import { renderHook } from "vitest-browser-react";

import { useInstallationApproval } from "../../src/components/session-key-installations/use-approval";
import { actor } from "../fixtures/actor";
import { managedWallet, preparedWalletTransaction } from "../fixtures/wallet-transaction";

const boundary = vi.hoisted(() => ({
  prepare: vi.fn(),
  complete: vi.fn(),
  prepareManaged: vi.fn(),
  approveManaged: vi.fn(),
  cancel: vi.fn(),
  review: vi.fn(),
  validate: vi.fn(),
  authenticate: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("../../src/env", () => ({ env: { backendUrl: "https://api.example.test" } }));
vi.mock("../../src/hooks/session-key", () => ({
  usePrepareSessionKeyOperation: () => ({ mutateAsync: boundary.prepare }),
  useCompleteSessionKeyOperation: () => ({ mutateAsync: boundary.complete }),
}));
vi.mock("../../src/hooks/session-key/operation", () => ({
  usePrepareManagedSessionKeyOperation: () => ({ mutateAsync: boundary.prepareManaged }),
  useApproveManagedSessionKeyOperation: () => ({ mutateAsync: boundary.approveManaged }),
  useCancelSessionKeyOperation: () => ({ mutateAsync: boundary.cancel }),
}));
vi.mock("../../src/components/session-key-installations/review", () => ({
  reviewSessionInstallation: boundary.review,
  reviewManagedSessionInstallation: boundary.review,
}));
vi.mock("@namera-ai/sdk", () => ({
  validateOwnerApproval: boundary.validate,
  validateManagedOwnerApproval: boundary.validate,
}));
vi.mock("@simplewebauthn/browser", () => ({ startAuthentication: boundary.authenticate }));
vi.mock("../../src/lib/toasts", () => ({ showErrorToast: boundary.toast }));

const localWallet = Schema.decodeUnknownSync(Schema.toType(WalletResponse))({
  ...managedWallet,
  owner: { signingKeyId: managedWallet.owner.signingKeyId, custody: "local", algorithm: "p256" },
  data: {
    version: 1,
    modularAccountVersion: "2.0.0",
    validatorType: "webauthn_p256",
    entryPointVersion: "0.7",
    salt: 0n,
    entityId: 0,
  },
});
const session = Schema.decodeUnknownSync(Schema.toType(SessionKeyResponse))({
  id: "01950000-0000-7000-8000-000000000005",
  organizationId: managedWallet.organizationId,
  walletId: managedWallet.id,
  signingKeyId: "01950000-0000-7000-8000-000000000006",
  namespace: "eip155",
  metadata: { version: 1, name: "Trading key" },
  policies: [],
  policyHash: "fixture",
  status: "active",
  revokedAt: null,
  createdAt: managedWallet.createdAt,
  signer: { custody: "local", algorithm: "secp256k1", publicKey: `0x04${"11".repeat(64)}` },
  wallet: managedWallet,
  creator: actor.member,
  installations: [
    {
      id: "01950000-0000-7000-8000-000000000007",
      chainId: "eip155:1",
      status: "installed",
      authorization: {
        version: 1,
        entityId: 7,
        signerAddress: managedWallet.address,
        validAfter: 0,
        validUntil: 2000000000,
        permissions: [{ type: "root" }],
        allowSignatures: false,
      },
      installTransactionHash: null,
      uninstallTransactionHash: null,
    },
  ],
});
const installation = session.installations[0];
if (!installation) throw new Error("Session fixture requires an installation");
const operationId = preparedWalletTransaction.operationId;
const options = {
  challenge: "dGVzdA",
  rpId: "localhost",
  timeout: 60000,
  userVerification: "required",
  allowCredentials: [{ id: "credential", type: "public-key" }],
};
const assertion = Schema.decodeUnknownSync(PasskeyAuthenticationResponse)({
  id: "credential",
  rawId: "credential",
  type: "public-key",
  response: {
    authenticatorData: "dGVzdA",
    clientDataJSON: "dGVzdA",
    signature: "dGVzdA",
  },
  clientExtensionResults: {},
});
const localPreparation = Schema.decodeUnknownSync(
  Schema.toType(PrepareSessionKeyOperationResponse),
)({
  namespace: "eip155",
  operationId,
  prepared: preparedWalletTransaction.prepared,
  expiresAt: preparedWalletTransaction.expiresAt,
  options,
});
const managedPreparation = Schema.decodeUnknownSync(
  Schema.toType(PrepareManagedSessionKeyOperationResponse),
)({
  namespace: "eip155",
  operationId,
  prepared: preparedWalletTransaction.prepared,
  expiresAt: preparedWalletTransaction.expiresAt,
  approval: "1claw",
});
const descriptor = Schema.decodeUnknownSync(GetWalletPasskeyOwnerResponse)({
  walletId: localWallet.id,
  owner: {
    signingKeyId: localWallet.owner.signingKeyId,
    publicKeyHex: `0x04${"11".repeat(64)}`,
    credentialId: "credential",
    rpId: "localhost",
  },
});

beforeEach(() => {
  Object.values(boundary).forEach((mock) => mock.mockReset());
  boundary.review.mockResolvedValue({
    chainId: "eip155:1",
    walletAddress: managedWallet.address,
    ownerEntityId: 0,
    callData: "0x12345678",
    sponsor: true,
  });
  boundary.prepare.mockResolvedValue(localPreparation);
  boundary.prepareManaged.mockResolvedValue(managedPreparation);
  boundary.authenticate.mockResolvedValue(assertion);
});

const workflows = [
  { kind: "install", custody: "managed" },
  { kind: "uninstall", custody: "managed" },
  { kind: "install", custody: "local" },
  { kind: "uninstall", custody: "local" },
] as const;

it.each(workflows)(
  "requires consent for $custody $kind and submits only the reviewed operation",
  async ({ kind, custody }) => {
    const managed = custody === "managed";
    const hook = await renderHook(() =>
      useInstallationApproval(
        managed ? session : { ...session, wallet: localWallet },
        installation,
        managed ? undefined : descriptor,
        kind,
      ),
    );
    let attempt!: Promise<void>;
    await hook.act(() => {
      attempt = hook.result.current.approve();
    });
    await expect.poll(() => hook.result.current.reviewOpen).toBe(true);
    await hook.act(() => hook.result.current.approve());
    expect(managed ? boundary.prepareManaged : boundary.prepare).toHaveBeenCalledTimes(1);
    expect(boundary.authenticate).not.toHaveBeenCalled();
    expect(boundary.complete).not.toHaveBeenCalled();
    expect(boundary.approveManaged).not.toHaveBeenCalled();
    await hook.act(() => hook.result.current.confirm(true));
    await attempt;
    expect(boundary.validate).toHaveBeenCalledTimes(2);
    if (managed) {
      expect(boundary.approveManaged).toHaveBeenCalledExactlyOnceWith({ payload: { operationId } });
      expect(boundary.authenticate).not.toHaveBeenCalled();
    } else {
      expect(boundary.authenticate).toHaveBeenCalledExactlyOnceWith({ optionsJSON: options });
      expect(boundary.complete).toHaveBeenCalledExactlyOnceWith({
        payload: { operationId, response: assertion },
      });
    }
    expect(boundary.cancel).not.toHaveBeenCalled();
  },
);

it.each(workflows)(
  "cancels unsigned $custody $kind without signing or approving",
  async ({ kind, custody }) => {
    const managed = custody === "managed";
    const hook = await renderHook(() =>
      useInstallationApproval(
        managed ? session : { ...session, wallet: localWallet },
        installation,
        managed ? undefined : descriptor,
        kind,
      ),
    );
    let attempt!: Promise<void>;
    await hook.act(() => {
      attempt = hook.result.current.approve();
    });
    await expect.poll(() => hook.result.current.reviewOpen).toBe(true);
    await hook.act(() => hook.result.current.confirm(false));
    await attempt;
    expect(boundary.cancel).toHaveBeenCalledExactlyOnceWith({ params: { operationId } });
    expect(boundary.authenticate).not.toHaveBeenCalled();
    expect(boundary.complete).not.toHaveBeenCalled();
    expect(boundary.approveManaged).not.toHaveBeenCalled();
    expect(hook.result.current.operationId).toBeUndefined();
  },
);

it("rechecks local approval after confirmation before invoking WebAuthn", async () => {
  boundary.validate
    .mockImplementationOnce(() => undefined)
    .mockImplementationOnce(() => {
      throw new Error("Expired");
    });
  const hook = await renderHook(() =>
    useInstallationApproval(
      { ...session, wallet: localWallet },
      installation,
      descriptor,
      "install",
    ),
  );
  let attempt!: Promise<void>;
  await hook.act(() => {
    attempt = hook.result.current.approve();
  });
  await expect.poll(() => hook.result.current.reviewOpen).toBe(true);
  await hook.act(() => hook.result.current.confirm(true));
  await attempt;
  expect(boundary.authenticate).not.toHaveBeenCalled();
  expect(boundary.complete).not.toHaveBeenCalled();
  expect(hook.result.current.error).toBe(true);
});

it("retains signed local completion for explicit retry without another prompt", async () => {
  boundary.complete.mockRejectedValueOnce(new Error("Network interrupted"));
  const hook = await renderHook(() =>
    useInstallationApproval(
      { ...session, wallet: localWallet },
      installation,
      descriptor,
      "uninstall",
    ),
  );
  let attempt!: Promise<void>;
  await hook.act(() => {
    attempt = hook.result.current.approve();
  });
  await expect.poll(() => hook.result.current.reviewOpen).toBe(true);
  await hook.act(() => hook.result.current.confirm(true));
  await attempt;
  expect(boundary.complete).toHaveBeenCalledTimes(1);
  expect(boundary.cancel).not.toHaveBeenCalled();
  await hook.act(() => hook.result.current.approve());
  expect(boundary.prepare).toHaveBeenCalledTimes(1);
  expect(boundary.authenticate).toHaveBeenCalledTimes(1);
  expect(boundary.complete.mock.calls[1]).toEqual(boundary.complete.mock.calls[0]);
});
