import type { ExecutionActivityView, ExecutionDetailsView } from "@namera-ai/application";
import type { ExecutionDetailsResponse, ExecutionListItemResponse } from "@namera-ai/protocol/dto";

import { toMemberResponse } from "./auth.js";
import { toSessionKeySummaryResponse } from "./session-key.js";
import { toWalletResponse } from "./wallet.js";

export const toExecutionListItemResponse = (
  input: ExecutionActivityView,
): ExecutionListItemResponse => input;

export const toExecutionDetailsResponse = (
  input: ExecutionDetailsView,
): ExecutionDetailsResponse => {
  const common = { id: input.actor.id, type: input.actorDetails.type } as const;
  let actor: ExecutionDetailsResponse["actor"];

  switch (input.actorDetails.type) {
    case "user":
      actor = {
        ...common,
        type: "user",
        member: toMemberResponse(input.actorDetails.member),
      };
      break;
    case "api-key": {
      const apiKey = input.actorDetails.apiKey;
      actor = {
        ...common,
        type: "api-key",
        apiKey: {
          id: apiKey.id,
          metadata: apiKey.metadata,
          keyStart: apiKey.keyStart,
          expiresAt: apiKey.expiresAt,
          lastUsedAt: apiKey.lastUsedAt,
          revokedAt: apiKey.revokedAt,
          createdAt: apiKey.createdAt,
          updatedAt: apiKey.updatedAt,
        },
      };
      break;
    }
    case "mcp":
    case "cli": {
      const authorization = input.actorDetails.authorization;
      const client = input.actorDetails.client;
      actor = {
        ...common,
        type: input.actorDetails.type,
        authorization: {
          id: authorization.id,
          client: {
            id: client.id,
            clientId: client.clientId,
            registrationType: client.registrationType,
            clientName: client.clientName,
            clientUri: client.clientUri,
            logoUri: client.logoUri,
          },
          scopes: authorization.scopes,
          resource: authorization.resource,
          status: authorization.status,
          metadata: authorization.metadata,
          expiresAt: authorization.expiresAt,
          lastUsedAt: authorization.lastUsedAt,
          revokedAt: authorization.revokedAt,
          createdAt: authorization.createdAt,
          updatedAt: authorization.updatedAt,
        },
      };
      break;
    }
  }

  return {
    execution: input.execution,
    wallet: toWalletResponse(input.wallet),
    sessionKey: toSessionKeySummaryResponse(input.sessionKey),
    actor,
  };
};
