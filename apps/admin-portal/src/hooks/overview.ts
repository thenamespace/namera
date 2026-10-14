import type { AdminOverviewPeriod } from "@namera-ai/protocol/dto";

import { overviewAtom } from "@/atoms/overview";
import { toQuery } from "@/hooks/atom";

export const useOverview = toQuery((period: AdminOverviewPeriod) => overviewAtom(period));
