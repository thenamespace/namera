import { apiKeyAtom, apiKeysAtom, createApiKeyMutation } from "@/atoms/api-key";
import { QueryKeys } from "@/atoms/query-keys";
import { toMutation, toQuery } from "@/hooks/atom";

export const useApiKeys = toQuery(() => apiKeysAtom);
export const useApiKey = toQuery(apiKeyAtom);

export const useCreateApiKey = toMutation(createApiKeyMutation, {
  invalidates: [...QueryKeys.apiKey.all, ...QueryKeys.apiKey.lists],
});
