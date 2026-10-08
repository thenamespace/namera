import type { AdminOverviewPeriod } from "@namera-ai/protocol/dto";

import { overviewAtom } from "@/atoms/overview";
import { toQuery } from "@/hooks/atom";

export function useOverview(period: AdminOverviewPeriod) {
  return toQuery(() => overviewAtom(period))();
}
