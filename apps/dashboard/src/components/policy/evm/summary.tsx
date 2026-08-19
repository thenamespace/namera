import { DateTime } from "effect";

import type { EvmSessionKeyPolicy } from "@namera-ai/protocol/model";
import { ChainIcon } from "@namera-ai/ui/icons";
import { formatUnits } from "viem";

import { formatDateTime } from "@/lib/helpers/date";

import { evmChainById, gasBudgetPeriodById, nativeSpendPeriodById } from "./data";
import type { EvmPolicyInput, SignaturePolicyInput } from "./types";

const signatureTypeLabels: Record<SignaturePolicyInput["allowedTypes"][number], string> = {
  message: "Messages",
  "typed-data": "Typed data",
};

type PolicySummaryValue = EvmPolicyInput | EvmSessionKeyPolicy;
type TimeWindowPolicySummaryValue = Extract<
  PolicySummaryValue,
  { readonly type: "evm.time-window" }
>;
type ChainAllowlistPolicySummaryValue = Extract<
  PolicySummaryValue,
  { readonly type: "evm.chain-allowlist" }
>;
type GasBudgetPolicySummaryValue = Extract<PolicySummaryValue, { readonly type: "evm.gas-budget" }>;
type NativeSpendLimitPolicySummaryValue = Extract<
  PolicySummaryValue,
  { readonly type: "evm.native-spend-limit" }
>;
type SignaturePolicySummaryValue = Extract<PolicySummaryValue, { readonly type: "evm.signature" }>;

function formatPolicyDate(value: string | DateTime.DateTime) {
  return typeof value === "string"
    ? formatDateTime(value)
    : DateTime.formatLocal(value, { dateStyle: "medium", timeStyle: "short" });
}

function TimeWindowPolicySummary({ policy }: { policy: TimeWindowPolicySummaryValue }) {
  return (
    <span>
      {policy.startsAt ? `From ${formatPolicyDate(policy.startsAt)}` : "Available immediately"}
      {" · "}
      Expires {formatPolicyDate(policy.expiresAt)}
    </span>
  );
}

function NetworkChip({
  chainId,
}: {
  chainId: ChainAllowlistPolicySummaryValue["chainIds"][number];
}) {
  const chain = evmChainById.get(chainId);
  if (!chain) return <span>{chainId}</span>;

  return (
    <span className="bg-surface text-muted inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs">
      <ChainIcon aria-hidden chain={chain.chain} className="size-3.5 shrink-0" namespace="eip155" />
      <span className="text-foreground font-medium">{chain.name}</span>
    </span>
  );
}

function ChainAllowlistPolicySummary({ policy }: { policy: ChainAllowlistPolicySummaryValue }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {policy.chainIds.map((chainId) => (
        <NetworkChip chainId={chainId} key={chainId} />
      ))}
    </span>
  );
}

function GasBudgetPolicySummary({ policy }: { policy: GasBudgetPolicySummaryValue }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {policy.budgets.map((budget) => {
        const chain = evmChainById.get(budget.chainId);
        const period = gasBudgetPeriodById.get(budget.period)?.label ?? budget.period;
        if (!chain) return <span key={`${budget.chainId}:${budget.period}`}>{budget.chainId}</span>;

        return (
          <span
            className="bg-surface text-muted inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs"
            key={`${budget.chainId}:${budget.period}`}
          >
            <ChainIcon
              aria-hidden
              chain={chain.chain}
              className="size-3.5 shrink-0"
              namespace="eip155"
            />
            <span className="text-foreground font-medium">
              {formatUnits(BigInt(budget.maxCost), chain.nativeCurrency.decimals)}
            </span>
            {chain.nativeCurrency.symbol}
            <span aria-hidden className="text-muted/70">
              ·
            </span>
            {period}
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

function NativeSpendLimitPolicySummary({ policy }: { policy: NativeSpendLimitPolicySummaryValue }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {policy.limits.map((limit) => {
        const chain = evmChainById.get(limit.chainId);
        const period = nativeSpendPeriodById.get(limit.period)?.label ?? limit.period;
        if (!chain) return <span key={`${limit.chainId}:${limit.period}`}>{limit.chainId}</span>;

        return (
          <span
            className="bg-surface text-muted inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs"
            key={`${limit.chainId}:${limit.period}`}
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
            {period}
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

function SignaturePolicySummary({ policy }: { policy: SignaturePolicySummaryValue }) {
  return <span>{policy.allowedTypes.map((type) => signatureTypeLabels[type]).join(" and ")}</span>;
}

export function EvmPolicySummary({ policy }: { policy: PolicySummaryValue }) {
  switch (policy.type) {
    case "evm.chain-allowlist":
      return <ChainAllowlistPolicySummary policy={policy} />;
    case "evm.gas-budget":
      return <GasBudgetPolicySummary policy={policy} />;
    case "evm.time-window":
      return <TimeWindowPolicySummary policy={policy} />;
    case "evm.native-spend-limit":
      return <NativeSpendLimitPolicySummary policy={policy} />;
    case "evm.signature":
      return <SignaturePolicySummary policy={policy} />;
  }
}
