import { executionAtom, executionsAtom } from "@/atoms/execution";
import { toQuery } from "@/hooks/atom";

export const useExecutions = toQuery(() => executionsAtom);
export const useExecution = toQuery(executionAtom);
