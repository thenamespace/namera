import { Context } from "effect";

import type { SessionKeyGrantView } from "@namera-ai/database";
import type {
  ActorId,
  McpAuthorizationId,
  OAuthClientId,
  OAuthTokenId,
  OrganizationId,
} from "@namera-ai/protocol";
import type { OAuthScope } from "@namera-ai/protocol/model";

export interface McpPrincipal {
  readonly authorizationId: McpAuthorizationId;
  readonly tokenId: OAuthTokenId;
  readonly organizationId: OrganizationId;
  readonly actorId: ActorId;
  readonly clientId: OAuthClientId;
  readonly scopes: ReadonlyArray<OAuthScope>;
  readonly grants: ReadonlyArray<SessionKeyGrantView>;
}

export const CurrentMcpPrincipal = Context.Reference<McpPrincipal | null>(
  "@namera-ai/server/CurrentMcpPrincipal",
  { defaultValue: () => null },
);
