import type { ApiKeyId } from "@namera-ai/protocol";

import { NameraClient } from "@/atoms/client";
import { QueryKeys } from "@/atoms/query-keys";

export const apiKeysAtom = NameraClient.query("apiKey", "list", {
  reactivityKeys: [
    ...QueryKeys.organization.active,
    ...QueryKeys.apiKey.all,
    ...QueryKeys.apiKey.lists,
  ],
  timeToLive: "30 seconds",
});

export const apiKeyAtom = (apiKeyId: ApiKeyId) =>
  NameraClient.query("apiKey", "get", {
    params: { apiKeyId },
    reactivityKeys: [
      ...QueryKeys.organization.active,
      ...QueryKeys.apiKey.all,
      ...QueryKeys.apiKey.details,
      ...QueryKeys.apiKey.detail(apiKeyId),
    ],
    timeToLive: "30 seconds",
  });

export const createApiKeyMutation = NameraClient.mutation("apiKey", "create");
