import type { ListWaitlistRequest } from "@namera-ai/protocol/dto";

import { QueryKeys } from "@/atoms/query-keys";
import { acceptWaitlistMutation, waitlistAtom } from "@/atoms/waitlist";
import { toMutation, toQuery } from "@/hooks/atom";

export const useWaitlist = toQuery((query: ListWaitlistRequest) => waitlistAtom(query));
export const useAcceptWaitlist = toMutation(acceptWaitlistMutation, {
  invalidates: [...QueryKeys.waitlist.list, ...QueryKeys.invites.list],
});
