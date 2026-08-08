import { Schema, Struct } from "effect";

import { OrganizationId } from "#/common/index";
import { Session } from "#/model/index";

export const GetSessionRequest = Schema.Void;
export const GetSessionResponse = Session.mapFields(
  Struct.pick([
    "id",
    "userId",
    "activeOrganizationId",
    "ipAddress",
    "userAgent",
    "expiresAt",
    "revokedAt",
  ]),
);

export const ListSessionsRequest = Schema.Void;
export const ListSessionsResponse = Schema.Array(GetSessionResponse);

export const SetActiveOrganizationRequest = Schema.Struct({
  id: OrganizationId,
});
export const SetActiveOrganizationResponse = Schema.Void;

export type GetSessionRequest = typeof GetSessionRequest.Type;
export type GetSessionResponse = typeof GetSessionResponse.Type;
export type ListSessionsRequest = typeof ListSessionsRequest.Type;
export type ListSessionsResponse = typeof ListSessionsResponse.Type;
export type SetActiveOrganizationRequest = typeof SetActiveOrganizationRequest.Type;
export type SetActiveOrganizationResponse = typeof SetActiveOrganizationResponse.Type;
