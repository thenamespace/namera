import {
  apiKeyAtom,
  apiKeysAtom,
  createApiKeyMutation,
  revokeApiKeyMutation,
} from "@/atoms/api-key";
import { QueryKeys } from "@/atoms/query-keys";
import { toMutation, toQuery } from "@/hooks/atom";

export const useApiKeys = toQuery(() => apiKeysAtom);
export const useApiKey = toQuery(apiKeyAtom);

export const useCreateApiKey = toMutation(createApiKeyMutation, {
  analyticsAction: "api_key_create",
  invalidates: [...QueryKeys.apiKey.all, ...QueryKeys.apiKey.lists],
});

export const useRevokeApiKey = toMutation(revokeApiKeyMutation, {
  analyticsAction: "api_key_revoke",
  invalidates: [...QueryKeys.apiKey.all],
});
