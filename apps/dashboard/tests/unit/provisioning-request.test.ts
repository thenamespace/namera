import { describe, expect, it } from "vitest";

import {
  completeProvisioningRequest,
  prepareProvisioningRequest,
} from "../../src/lib/provisioning-request.js";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe("managed provisioning retry identity", () => {
  it("survives reopening, normalizes object order, and rotates only after success", async () => {
    const storage = memoryStorage();
    const first = await prepareProvisioningRequest(
      "org:user:wallet-root",
      { metadata: { name: "Private label", version: 1 } },
      storage,
    );
    const retry = await prepareProvisioningRequest(
      "org:user:wallet-root",
      { metadata: { version: 1, name: "Private label" } },
      storage,
    );
    expect(retry).toEqual(first);
    expect(storage.key(0)).not.toContain("Private label");
    completeProvisioningRequest(first, storage);
    expect(
      (
        await prepareProvisioningRequest(
          "org:user:wallet-root",
          { metadata: { version: 1, name: "Private label" } },
          storage,
        )
      ).idempotencyKey,
    ).not.toBe(first.idempotencyKey);
  });
  it("isolates accounts and changed requests and does not clear a newer retry key", async () => {
    const storage = memoryStorage();
    const first = await prepareProvisioningRequest("org:user:session", { name: "A" }, storage);
    expect(
      (await prepareProvisioningRequest("other:user:session", { name: "A" }, storage))
        .idempotencyKey,
    ).not.toBe(first.idempotencyKey);
    expect(
      (await prepareProvisioningRequest("org:user:session", { name: "B" }, storage)).idempotencyKey,
    ).not.toBe(first.idempotencyKey);
    const replacement = crypto.randomUUID();
    storage.setItem(first.storageKey, replacement);
    completeProvisioningRequest(first, storage);
    expect(storage.getItem(first.storageKey)).toBe(replacement);
  });
  it("fails before submission when persistent retry storage is unavailable or corrupt", async () => {
    const storage = memoryStorage();
    const first = await prepareProvisioningRequest("org:user:wallet-root", {}, storage);
    storage.setItem(first.storageKey, "invalid");
    await expect(prepareProvisioningRequest("org:user:wallet-root", {}, storage)).rejects.toThrow();
    storage.clear();
    storage.setItem = () => {
      throw new Error("storage unavailable");
    };
    await expect(prepareProvisioningRequest("org:user:wallet-root", {}, storage)).rejects.toThrow(
      "storage unavailable",
    );
  });
});
