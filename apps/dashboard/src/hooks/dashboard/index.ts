import { dashboardOverviewAtom } from "@/atoms/dashboard";
import { toQuery } from "@/hooks/atom";

export const useDashboardOverview = toQuery(() => dashboardOverviewAtom);
