import { Schema } from "effect";

const RetryKey = Schema.String.check(Schema.isUUID());

// Persist only a request digest and random retry key, never provider credentials or form data.
export async function prepareProvisioningRequest(
  scope: string,
  request: unknown,
  storage: Storage = localStorage,
) {
  const canonical = JSON.stringify(request, (key, value) => {
    if (key === "idempotencyKey") return undefined;
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).toSorted(([a], [b]) => a.localeCompare(b)))
      : value;
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const storageKey = `namera:provisioning:${scope}:${hash}`;
  const existing = storage.getItem(storageKey);
  const idempotencyKey =
    existing === null ? crypto.randomUUID() : Schema.decodeUnknownSync(RetryKey)(existing);
  storage.setItem(storageKey, idempotencyKey);
  return { idempotencyKey, storageKey };
}

export function completeProvisioningRequest(
  attempt: { idempotencyKey: string; storageKey: string },
  storage: Storage = localStorage,
) {
  if (storage.getItem(attempt.storageKey) === attempt.idempotencyKey)
    storage.removeItem(attempt.storageKey);
}
