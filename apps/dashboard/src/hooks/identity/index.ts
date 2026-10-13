import {
  createIdentityMutation,
  identitiesAtom,
  identityAtom,
  identityNetworksAtom,
  updateIdentityRecordsMutation,
} from "@/atoms/identity";
import { QueryKeys } from "@/atoms/query-keys";
import { toMutation, toQuery } from "@/hooks/atom";

export const useIdentities = toQuery(identitiesAtom);
export const useIdentity = toQuery(identityAtom);
export const useIdentityNetworks = toQuery(() => identityNetworksAtom);
export const useCreateIdentity = toMutation(createIdentityMutation, {
  invalidates: QueryKeys.identity.all,
});
export const useUpdateIdentityRecords = toMutation(updateIdentityRecordsMutation, {
  invalidates: QueryKeys.identity.all,
});
