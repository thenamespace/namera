import { ensNameAvailabilityMutation } from "@/atoms/ens";
import { toMutation } from "@/hooks/atom";

export const useEnsNameAvailability = toMutation(ensNameAvailabilityMutation);
