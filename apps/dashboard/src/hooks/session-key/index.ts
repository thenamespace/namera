import { QueryKeys } from "@/atoms/query-keys";
import {
  createSessionKeyMutation,
  revokeSessionKeyMutation,
  sessionKeyAtom,
  sessionKeysAtom,
  walletSessionKeysAtom,
} from "@/atoms/session-key";
import { toMutation, toQuery } from "@/hooks/atom";

export * from "./operation";

export const useSessionKeys = toQuery(() => sessionKeysAtom);
export const useWalletSessionKeys = toQuery(walletSessionKeysAtom);
export const useSessionKey = toQuery(sessionKeyAtom);

export const useCreateSessionKey = toMutation(createSessionKeyMutation, {
  invalidates: ({ payload }) => [
    ...QueryKeys.billing.current,
    ...QueryKeys.sessionKey.all,
    ...QueryKeys.sessionKey.lists,
    ...QueryKeys.sessionKey.organizationLists,
    ...QueryKeys.sessionKey.walletLists,
    ...QueryKeys.sessionKey.walletList(payload.walletId),
  ],
});

export const useRevokeSessionKey = toMutation(revokeSessionKeyMutation, {
  invalidates: [
    ...QueryKeys.sessionKey.all,
    ...QueryKeys.apiKey.all,
    ...QueryKeys.oauth.authorizations,
    ...QueryKeys.oauth.cliAuthorizations,
  ],
});
