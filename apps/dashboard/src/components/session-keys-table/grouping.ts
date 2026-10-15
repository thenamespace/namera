import type { SessionKeyResponse } from "@namera-ai/protocol/dto";

import { sessionKeyDisplayStatus } from "@/components/display/session-key-status-display";

import type { SessionKeyGrouping } from "./columns";

type GroupableSessionKey = Pick<SessionKeyResponse, "status" | "namespace"> & {
  wallet: { id: string; metadata: { name: string } };
};

export function groupSessionKeys<T extends GroupableSessionKey>(
  sessionKeys: readonly T[],
  grouping: Exclude<SessionKeyGrouping, "none">,
) {
  const groups = new Map<
    string,
    { id: string; kind: "group"; grouping: typeof grouping; label: string; children: T[] }
  >();

  for (const sessionKey of sessionKeys) {
    const key =
      grouping === "account"
        ? sessionKey.wallet.id
        : grouping === "status"
          ? sessionKeyDisplayStatus(sessionKey.status)
          : sessionKey.namespace;
    const existing = groups.get(key);

    if (existing !== undefined) {
      existing.children.push(sessionKey);
      continue;
    }

    groups.set(key, {
      id: `group:${grouping}:${key}`,
      kind: "group",
      grouping,
      label: grouping === "account" ? sessionKey.wallet.metadata.name : key,
      children: [sessionKey],
    });
  }

  return [...groups.values()];
}
