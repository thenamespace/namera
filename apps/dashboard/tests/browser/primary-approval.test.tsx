import { EnsLabel } from "@namera-ai/protocol";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderHook } from "vitest-browser-react";

import { usePrimaryApproval } from "../../src/routes/_authenticated/identity/-components/use-primary-approval";
import { managedWallet, preparedWalletTransaction } from "../fixtures/wallet-transaction";

const boundary = vi.hoisted(() => ({
  prepare: vi.fn(),
  approve: vi.fn(),
  cancel: vi.fn(),
  review: vi.fn(),
  validate: vi.fn(),
  passkey: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("../../src/env", () => ({ env: { backendUrl: "https://api.example.test" } }));
vi.mock("../../src/hooks/wallet/transaction", () => ({
  usePrepareWalletTransaction: () => ({ mutateAsync: boundary.prepare }),
  useCompleteWalletTransaction: () => ({ mutateAsync: boundary.approve }),
  useCancelWalletTransaction: () => ({ mutateAsync: boundary.cancel }),
}));
vi.mock("@namera-ai/evm/identity-review", () => ({
  reviewPrimaryName: boundary.review,
  validatePrimaryApproval: boundary.validate,
}));
vi.mock("@simplewebauthn/browser", () => ({ startAuthentication: boundary.passkey }));
vi.mock("../../src/lib/toasts", () => ({ showErrorToast: boundary.toast }));

beforeEach(() => {
  Object.values(boundary).forEach((mock) => mock.mockReset());
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
  boundary.review.mockResolvedValue({
    call: { to: managedWallet.address, value: 0n, data: "0x12345678" },
  });
  boundary.prepare.mockResolvedValue(preparedWalletTransaction);
  boundary.approve.mockResolvedValue(undefined);
  boundary.cancel.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

async function mountApproval() {
  const refresh = vi.fn();
  const hook = await renderHook(() =>
    usePrimaryApproval(managedWallet, EnsLabel.make("example"), undefined, refresh, undefined),
  );
  return { ...hook, refresh };
}

it("prepares once, waits for explicit confirmation and completes only the reviewed operation", async () => {
  const hook = await mountApproval();
  let attempt!: Promise<void>;
  await hook.act(() => {
    attempt = hook.result.current.start(null);
  });
  await expect.poll(() => hook.result.current.progress).toBe("Reviewing…");
  await hook.act(() => hook.result.current.start(null));
  expect(boundary.prepare).toHaveBeenCalledTimes(1);
  expect(boundary.approve).not.toHaveBeenCalled();
  expect(boundary.passkey).not.toHaveBeenCalled();
  await hook.act(() => hook.result.current.answer(true));
  await attempt;
  expect(boundary.validate).toHaveBeenCalledTimes(2);
  expect(boundary.approve).toHaveBeenCalledExactlyOnceWith({
    params: { walletId: managedWallet.id },
    payload: { namespace: "eip155", operationId: preparedWalletTransaction.operationId },
  });
  expect(boundary.cancel).not.toHaveBeenCalled();
  expect(hook.refresh).toHaveBeenCalledOnce();
});

it("cancels only unsigned preparation and creates a new retry identity afterward", async () => {
  const hook = await mountApproval();
  let first!: Promise<void>;
  await hook.act(() => {
    first = hook.result.current.start(null);
  });
  await expect.poll(() => hook.result.current.progress).toBe("Reviewing…");
  await hook.act(() => hook.result.current.answer(false));
  await first;
  expect(boundary.cancel).toHaveBeenCalledExactlyOnceWith({
    params: { walletId: managedWallet.id, operationId: preparedWalletTransaction.operationId },
  });
  expect(boundary.approve).not.toHaveBeenCalled();
  let second!: Promise<void>;
  await hook.act(() => {
    second = hook.result.current.start(null);
  });
  await expect.poll(() => hook.result.current.progress).toBe("Reviewing…");
  expect(boundary.prepare.mock.calls[0]?.[0].headers["idempotency-key"]).not.toBe(
    boundary.prepare.mock.calls[1]?.[0].headers["idempotency-key"],
  );
  await hook.act(() => hook.result.current.answer(false));
  await second;
});

it("does not approve when validation fails after confirmation", async () => {
  boundary.validate
    .mockImplementationOnce(() => undefined)
    .mockImplementationOnce(() => {
      throw new Error("Expired preparation");
    });
  const hook = await mountApproval();
  let attempt!: Promise<void>;
  await hook.act(() => {
    attempt = hook.result.current.start(null);
  });
  await expect.poll(() => hook.result.current.progress).toBe("Reviewing…");
  await hook.act(() => hook.result.current.answer(true));
  await attempt;
  expect(boundary.approve).not.toHaveBeenCalled();
  expect(boundary.passkey).not.toHaveBeenCalled();
  expect(boundary.toast).toHaveBeenCalledWith(
    expect.objectContaining({ message: "Expired preparation" }),
    expect.any(Object),
  );
});

it("preserves the submitted assertion for an explicit retry after uncertain completion", async () => {
  boundary.approve.mockRejectedValueOnce(new Error("Network interrupted"));
  const hook = await mountApproval();
  let attempt!: Promise<void>;
  await hook.act(() => {
    attempt = hook.result.current.start(null);
  });
  await expect.poll(() => hook.result.current.progress).toBe("Reviewing…");
  await hook.act(() => hook.result.current.answer(true));
  await attempt;
  expect(boundary.approve).toHaveBeenCalledTimes(1);
  expect(boundary.cancel).not.toHaveBeenCalled();
  await hook.act(() => hook.result.current.start(null));
  expect(boundary.prepare).toHaveBeenCalledTimes(1);
  expect(boundary.approve).toHaveBeenCalledTimes(2);
  expect(boundary.approve.mock.calls[1]?.[0]).toEqual(boundary.approve.mock.calls[0]?.[0]);
});

it("aborts an open review on unmount without signing or submitting", async () => {
  const hook = await mountApproval();
  let attempt!: Promise<void>;
  await hook.act(() => {
    attempt = hook.result.current.start(null);
  });
  await expect.poll(() => hook.result.current.progress).toBe("Reviewing…");
  await hook.unmount();
  await attempt;
  expect(boundary.passkey).not.toHaveBeenCalled();
  expect(boundary.approve).not.toHaveBeenCalled();
  expect(hook.refresh).not.toHaveBeenCalled();
});

it("reports cancellation errors and retains the same preparation for retry", async () => {
  boundary.cancel.mockRejectedValueOnce(new Error("Cancellation unavailable"));
  const hook = await mountApproval();
  let attempt!: Promise<void>;
  await hook.act(() => {
    attempt = hook.result.current.start(null);
  });
  await expect.poll(() => hook.result.current.progress).toBe("Reviewing…");
  await hook.act(() => hook.result.current.answer(false));
  await attempt;
  expect(boundary.toast).toHaveBeenCalledOnce();
  await hook.act(() => {
    attempt = hook.result.current.start(null);
  });
  await expect.poll(() => hook.result.current.progress).toBe("Reviewing…");
  expect(boundary.prepare).toHaveBeenCalledTimes(1);
  await hook.act(() => hook.result.current.answer(false));
  await attempt;
  expect(boundary.cancel).toHaveBeenCalledTimes(2);
  expect(boundary.approve).not.toHaveBeenCalled();
});
