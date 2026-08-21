import { billingAtom } from "@/atoms/billing";
import { toQuery } from "@/hooks/atom";

export const useBilling = toQuery(() => billingAtom);
