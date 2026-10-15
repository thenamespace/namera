import { describe, expect, it } from "vitest";

import { groupSessionKeys } from "../../../src/components/session-keys-table/grouping";

const first = {
  id: "session-1",
  wallet: { id: "wallet-1", metadata: { name: "Trading" } },
  namespace: "eip155" as const,
  status: "active" as const,
};
const second = { ...first, id: "session-2", wallet: { ...first.wallet, id: "wallet-2" } };
const third = { ...first, id: "session-3" };

describe("session-key table grouping", () => {
  it("separates same-named accounts and keeps sessions for one account together in order", () => {
    const groups = groupSessionKeys([first, second, third], "account");

    expect(groups.map(({ label, children }) => ({ label, children }))).toEqual([
      { label: "Trading", children: [first, third] },
      { label: "Trading", children: [second] },
    ]);
    expect(new Set(groups.map(({ id }) => id)).size).toBe(2);
  });

  it("preserves group identity when the account is renamed", () => {
    const renamed = { ...first, wallet: { ...first.wallet, metadata: { name: "Treasury" } } };
    const before = groupSessionKeys([first], "account");
    const after = groupSessionKeys([renamed], "account");

    expect(after[0]?.id).toBe(before[0]?.id);
    expect(after[0]?.label).toBe("Treasury");
  });

  it("retains namespace and displayed-status grouping", () => {
    const revoked = { ...second, status: "revoked" as const };
    const revoking = { ...third, status: "revoking" as const };

    expect(groupSessionKeys([first, second], "namespace")[0]?.children).toEqual([first, second]);
    expect(
      groupSessionKeys([first, revoked, revoking], "status").map(({ label, children }) => ({
        label,
        children,
      })),
    ).toEqual([
      { label: "active", children: [first] },
      { label: "revoked", children: [revoked, revoking] },
    ]);
    expect(groupSessionKeys([], "account")).toEqual([]);
  });
});
