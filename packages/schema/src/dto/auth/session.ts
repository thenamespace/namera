import { Schema, Struct } from "effect";

import { Session } from "@/auth";

export const ListSessionResponse = Schema.Array(
  Session.mapFields(
    Struct.pick([
      "id",
      "userId",
      "ipAddress",
      "userAgent",
      "activeOrganizationId",
      "createdAt",
      "deletedAt",
      "expiresAt",
      "revokedAt",
      "updatedAt",
    ]),
  ),
);

export type ListSessionResponse = typeof ListSessionResponse.Type;
