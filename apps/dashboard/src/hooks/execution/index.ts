import {
  executionAtom,
  executionsAtom,
  sessionKeyExecutionsAtom,
  walletExecutionsAtom,
} from "@/atoms/execution";
import { toQuery } from "@/hooks/atom";

export const useExecutions = toQuery(() => executionsAtom);
export const useWalletExecutions = toQuery(walletExecutionsAtom);
export const useSessionKeyExecutions = toQuery(sessionKeyExecutionsAtom);
export const useExecution = toQuery(executionAtom);
