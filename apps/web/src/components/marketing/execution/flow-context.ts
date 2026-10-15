import { createContext, useContext } from "react";

import type { CardState, Cell, ChainId, RouteId, SourceId } from "./model";

// React Flow owns node positions; this context carries only the simulated run.
export type Flow = {
  readonly source: SourceId;
  readonly routeId: RouteId;
  readonly amount: number;
  readonly chain: ChainId;
  readonly onSource: (value: SourceId) => void;
  readonly onRoute: (value: RouteId) => void;
  readonly onAmount: (value: number) => void;
  readonly onChain: (value: ChainId) => void;
  readonly prepareCells: readonly Cell[];
  readonly policyCells: readonly Cell[];
  readonly policyDetails: readonly string[];
  readonly capFill: number;
  readonly capOver: boolean;
  readonly intentState: CardState;
  readonly issueState: CardState;
  readonly prepareState: CardState;
  readonly policyState: CardState;
  readonly refusedState: CardState;
  readonly stateAt: (beat: number) => CardState;
  readonly refusedReason: string;
  readonly sell: "USDC" | "ETH";
  readonly buy: string;
  readonly amountValue: string;
  readonly chainLabel: string;
};

export const FlowContext = createContext<Flow | null>(null);

export const useFlow = () => {
  const value = useContext(FlowContext);
  if (value === null) throw new Error("execution canvas node rendered outside its provider");
  return value;
};
