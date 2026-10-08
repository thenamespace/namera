import { platformPermissions } from "@namera-ai/protocol/model";
import { describe, expect, it } from "vitest";

import {
  acceptWaitlistPermission,
  hasPermissions,
  readWaitlistPermission,
} from "../../src/components/permission";

describe("waitlist controls", () => {
  it.each(["owner", "operator", "viewer"] as const)(
    "gates %s actions with server-owned permissions",
    (role) => {
      expect(hasPermissions(platformPermissions[role], readWaitlistPermission)).toBe(true);
      expect(hasPermissions(platformPermissions[role], acceptWaitlistPermission)).toBe(
        role !== "viewer",
      );
    },
  );
  it("hides both reads and acceptance without permission", () => {
    expect(hasPermissions([], readWaitlistPermission)).toBe(false);
    expect(hasPermissions([], acceptWaitlistPermission)).toBe(false);
  });
});
