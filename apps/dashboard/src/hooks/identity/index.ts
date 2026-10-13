import {
  createIdentityMutation,
  identitiesAtom,
  identityAtom,
  identityNetworksAtom,
  updateIdentityRecordsMutation,
  identityPrimaryAtom,
  prepareIdentityPrimaryMutation,
  approveIdentityPrimaryMutation,
} from "@/atoms/identity";
import { QueryKeys } from "@/atoms/query-keys";
import { toMutation, toQuery } from "@/hooks/atom";

export const useIdentities = toQuery(identitiesAtom);
export const useIdentity = toQuery(identityAtom);
export const useIdentityNetworks = toQuery(() => identityNetworksAtom);
export const useIdentityPrimary = toQuery(identityPrimaryAtom);
export const usePrepareIdentityPrimary = toMutation(prepareIdentityPrimaryMutation);
export const useApproveIdentityPrimary = toMutation(approveIdentityPrimaryMutation, {
  invalidates: [...QueryKeys.identity.all, ...QueryKeys.billing.current],
});
export const useCreateIdentity = toMutation(createIdentityMutation, {
  invalidates: QueryKeys.identity.all,
});
export const useUpdateIdentityRecords = toMutation(updateIdentityRecordsMutation, {
  invalidates: QueryKeys.identity.all,
});
