import { SessionKeyOperationId } from "@namera-ai/protocol";
import type { PrepareManagedSessionKeyOperationResponse } from "@namera-ai/protocol/dto";
import type { ReviewedManagedOwnerOperation } from "@namera-ai/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { confirmManagedApproval } from "../../../src/components/session-key-installations/confirm-managed-approval";

// SDK tests exercise real envelope validation; this boundary checks user consent sequencing.
const { validate } = vi.hoisted(() => ({ validate: vi.fn() }));
vi.mock("@namera-ai/sdk", () => ({ validateManagedOwnerApproval: validate }));
const operationId = SessionKeyOperationId.make("01950000-0000-7000-8000-000000000001");
const fixture = () => ({
  kind: "uninstall" as const,
  reviewed: {} as ReviewedManagedOwnerOperation,
  response: { operationId } as PrepareManagedSessionKeyOperationResponse,
  signal: new AbortController().signal,
  requestConfirmation: vi.fn(async () => true),
  approve: vi.fn(async () => undefined),
});

describe("managed-owner approval consent", () => {
  beforeEach(() => validate.mockReset());
  it("approves installation after validation without a second confirmation", async () => {
    const input = { ...fixture(), kind: "install" as const };
    await expect(confirmManagedApproval(input)).resolves.toBe(true);
    expect(input.requestConfirmation).not.toHaveBeenCalled();
    expect(validate).toHaveBeenCalledTimes(1);
    expect(input.approve).toHaveBeenCalledExactlyOnceWith({ operationId });
    expect(validate.mock.invocationCallOrder[0]).toBeLessThan(
      Number(input.approve.mock.invocationCallOrder[0]),
    );
  });
  it("does not approve an invalid installation", async () => {
    const input = { ...fixture(), kind: "install" as const };
    validate.mockImplementationOnce(() => {
      throw new Error("Invalid");
    });
    await expect(confirmManagedApproval(input)).rejects.toThrow("Invalid");
    expect(input.requestConfirmation).not.toHaveBeenCalled();
    expect(input.approve).not.toHaveBeenCalled();
  });
  it("does not approve installation after navigation cancels it", async () => {
    const controller = new AbortController();
    controller.abort();
    const input = { ...fixture(), kind: "install" as const, signal: controller.signal };
    await expect(confirmManagedApproval(input)).resolves.toBe(false);
    expect(input.approve).not.toHaveBeenCalled();
  });
  it("sends only the reviewed operation ID after confirmation and a second validation", async () => {
    const input = fixture();
    await expect(confirmManagedApproval(input)).resolves.toBe(true);
    expect(validate).toHaveBeenCalledTimes(2);
    expect(input.approve).toHaveBeenCalledExactlyOnceWith({ operationId });
    expect(validate.mock.invocationCallOrder[0]).toBeLessThan(
      Number(input.requestConfirmation.mock.invocationCallOrder[0]),
    );
    expect(input.requestConfirmation.mock.invocationCallOrder[0]).toBeLessThan(
      Number(validate.mock.invocationCallOrder[1]),
    );
    expect(validate.mock.invocationCallOrder[1]).toBeLessThan(
      Number(input.approve.mock.invocationCallOrder[0]),
    );
  });
  it("does not sign when the user cancels", async () => {
    const input = fixture();
    input.requestConfirmation.mockResolvedValue(false);
    await expect(confirmManagedApproval(input)).resolves.toBe(false);
    expect(input.approve).not.toHaveBeenCalled();
  });
  it("does not sign after navigating away during confirmation", async () => {
    const input = fixture();
    const controller = new AbortController();
    input.requestConfirmation.mockImplementation(async () => {
      controller.abort();
      return true;
    });
    await expect(confirmManagedApproval({ ...input, signal: controller.signal })).resolves.toBe(
      false,
    );
    expect(input.approve).not.toHaveBeenCalled();
  });
  it("rejects a preparation that expires while the dialog is open", async () => {
    const input = fixture();
    validate
      .mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => {
        throw new Error("Expired");
      });
    await expect(confirmManagedApproval(input)).rejects.toThrow("Expired");
    expect(input.approve).not.toHaveBeenCalled();
  });
  it("does not show confirmation for an invalid envelope", async () => {
    const input = fixture();
    validate.mockImplementationOnce(() => {
      throw new Error("Invalid");
    });
    await expect(confirmManagedApproval(input)).rejects.toThrow("Invalid");
    expect(input.requestConfirmation).not.toHaveBeenCalled();
    expect(input.approve).not.toHaveBeenCalled();
  });
});
