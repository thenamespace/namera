import { Schema } from "effect";

import { PlatformMeResponse } from "@namera-ai/protocol/dto";
import type { PlatformPermission } from "@namera-ai/protocol/model";

export function adminResponse(
  permissions: readonly PlatformPermission[],
  role: "owner" | "operator" | "viewer" = "viewer",
) {
  const admin = Schema.decodeUnknownSync(PlatformMeResponse)({
    member: {
      id: "member-1",
      userId: "01900000-0000-7000-8000-000000000001",
      role,
      status: "active",
      createdAt: new Date("2026-10-01T00:00:00Z"),
      updatedAt: new Date("2026-10-01T00:00:00Z"),
    },
    email: "team@example.com",
    permissions,
  });

  return Schema.encodeSync(Schema.toCodecJson(PlatformMeResponse))(admin);
}
