import { Schema, Struct } from "effect";

import { Session } from "@/database";

export const GetSessionResponse = Session.mapFields(
  Struct.pick([
    "id",
    "userId",
    "activeOrganizationId",
    "metadata",
    "expiresAt",
    "revokedAt",
  ]),
);

export const ListSessionsResponse = Schema.Array(GetSessionResponse);

export type GetSessionResponse = typeof GetSessionResponse.Type;
export type ListSessionsResponse = typeof ListSessionsResponse.Type;
