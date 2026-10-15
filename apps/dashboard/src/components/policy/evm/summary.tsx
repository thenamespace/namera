import { DateTime } from "effect";

import { EthereumAddress } from "@namera-ai/protocol/evm";
import type { EvmSessionKeyPolicy } from "@namera-ai/protocol/model";
import { ChainIcon } from "@namera-ai/ui/icons";

import { chainDataById } from "@/components/display/chain-display";
import { EvmAddressDisplay } from "@/components/display/evm-address-display";

import { evmChainById } from "./data";
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
type SignaturePolicySummaryValue = Extract<PolicySummaryValue, { readonly type: "evm.signature" }>;

function formatPolicyDate(value: string | DateTime.DateTime) {
  return typeof value === "string"
    ? new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" })
    : DateTime.formatLocal(value, { dateStyle: "medium" });
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

function SignaturePolicySummary({ policy }: { policy: SignaturePolicySummaryValue }) {
  return (
    <span className="grid gap-2">
      <span>{policy.allowedTypes.map((type) => signatureTypeLabels[type]).join(" and ")}</span>
      {policy.allowedTypes.includes("typed-data")
        ? (policy.typedDataRules?.map((rule, index) => {
            const network = chainDataById.get(rule.chainId);
            return (
              <span
                className="bg-surface grid gap-1 rounded-md p-2 text-[11px] leading-4"
                // Read-only tuples have no IDs and may contain identical rules.
                // oxlint-disable-next-line react/no-array-index-key
                key={`${rule.chainId}:${rule.verifyingContract}:${index}`}
              >
                <span className="flex flex-wrap items-center gap-1.5">
                  {network ? (
                    <ChainIcon
                      namespace="eip155"
                      chain={network.name}
                      className="size-3 shrink-0"
                      aria-hidden
                    />
                  ) : null}
                  {evmChainById.get(rule.chainId)?.name ?? rule.chainId} ·{" "}
                  {rule.primaryTypes.join(", ")}
                </span>
                <EvmAddressDisplay
                  size="sm"
                  address={EthereumAddress.make(rule.verifyingContract)}
                  chainId={rule.chainId}
                />
                <span className="text-muted">
                  {rule.name === undefined ? "Any domain name" : `Name: ${rule.name}`} ·{" "}
                  {rule.version === undefined ? "Any version" : `Version: ${rule.version}`}
                </span>
              </span>
            );
          }) ?? null)
        : null}
    </span>
  );
}

export function EvmPolicySummary({ policy }: { policy: PolicySummaryValue }) {
  switch (policy.type) {
    case "evm.chain-allowlist":
      return <ChainAllowlistPolicySummary policy={policy} />;
    case "evm.time-window":
      return <TimeWindowPolicySummary policy={policy} />;
    case "evm.signature":
      return <SignaturePolicySummary policy={policy} />;
  }
}
