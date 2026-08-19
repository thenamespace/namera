import { ChainIcon } from "@namera-ai/ui/icons";
import { formatUnits } from "viem";

import { formatDateTime } from "@/lib/helpers/date";

import { evmChainById } from "./data";
import type {
  EvmPolicyInput,
  NativeSpendLimitPolicyInput,
  SignaturePolicyInput,
  TimeWindowPolicyInput,
} from "./types";

const signatureTypeLabels: Record<SignaturePolicyInput["allowedTypes"][number], string> = {
  message: "Messages",
  "typed-data": "Typed data",
};

function TimeWindowPolicySummary({ policy }: { policy: TimeWindowPolicyInput }) {
  return (
    <span>
      {policy.startsAt ? `From ${formatDateTime(policy.startsAt)}` : "Available immediately"}
      {" · "}
      Expires {formatDateTime(policy.expiresAt)}
    </span>
  );
}

function NativeSpendLimitPolicySummary({ policy }: { policy: NativeSpendLimitPolicyInput }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {policy.limits.map((limit) => {
        const chain = evmChainById.get(limit.chainId);
        if (!chain) return <span key={limit.chainId}>{limit.chainId}</span>;

        return (
          <span
            className="bg-surface text-muted inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs"
            key={limit.chainId}
          >
            <ChainIcon
              aria-hidden
              chain={chain.chain}
              className="size-3.5 shrink-0"
              namespace="eip155"
            />
            <span className="text-foreground font-medium">
              {formatUnits(BigInt(limit.maxAmount), chain.nativeCurrency.decimals)}
            </span>
            {chain.nativeCurrency.symbol}
            <span aria-hidden className="text-muted/70">
              ·
            </span>
            {chain.name}
          </span>
        );
      })}
    </span>
  );
}

function SignaturePolicySummary({ policy }: { policy: SignaturePolicyInput }) {
  return <span>{policy.allowedTypes.map((type) => signatureTypeLabels[type]).join(" and ")}</span>;
}

export function EvmPolicySummary({ policy }: { policy: EvmPolicyInput }) {
  switch (policy.type) {
    case "evm.time-window":
      return <TimeWindowPolicySummary policy={policy} />;
    case "evm.native-spend-limit":
      return <NativeSpendLimitPolicySummary policy={policy} />;
    case "evm.signature":
      return <SignaturePolicySummary policy={policy} />;
  }
}
