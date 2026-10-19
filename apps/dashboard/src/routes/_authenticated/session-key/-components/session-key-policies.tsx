import { useMemo, useState } from "react";

import type { SessionKeyResponse } from "@namera-ai/protocol/dto";
import type { SupportedEvmChainId } from "@namera-ai/protocol/evm";
import { Field, FieldLabel, Typography } from "@namera-ai/ui";
import { Calendar03Icon, Globe02Icon, HugeiconsIcon } from "@namera-ai/ui/icons";

import { EvmChainSelect } from "@/components/evm-chain-select";
import { EvmPolicyDisplayCard } from "@/components/policy/evm";
import { LifetimeSummary } from "@/components/policy/evm/lifetime-summary";
import { OnchainPolicyCard } from "@/components/policy/evm/onchain/display-card";
import { SessionPolicyCard } from "@/components/policy/evm/session-policy-card";
import { SessionKeyInstallations } from "@/components/session-key-installations";

import { groupInstallationPermissions } from "./permission-groups";

const signatureLogo = <HugeiconsIcon icon={Globe02Icon} />;
const lifetimeLogo = <HugeiconsIcon icon={Calendar03Icon} />;

type SessionKeyPoliciesProps = {
  sessionKey: SessionKeyResponse;
};

export function SessionKeyPolicies({ sessionKey }: SessionKeyPoliciesProps) {
  const [selectedChain, setSelectedChain] = useState<SupportedEvmChainId>();
  const chainIds = useMemo(
    () => [...new Set(sessionKey.installations.map(({ chainId }) => chainId))],
    [sessionKey.installations],
  );
  const activeChain = chainIds.find((chainId) => chainId === selectedChain) ?? chainIds[0] ?? null;
  const installations = sessionKey.installations.filter(({ chainId }) => chainId === activeChain);
  const permissions = groupInstallationPermissions(installations);

  return (
    <section className="mx-auto w-full max-w-5xl py-4 sm:px-2 sm:py-8">
      <div className="grid max-w-2xl gap-6">
        <Typography.Heading className="text-2xl tracking-tight" level={2}>
          Policies
        </Typography.Heading>
        <Field>
          <FieldLabel id="view-policy-network-label">Viewing policies for</FieldLabel>
          <EvmChainSelect
            aria-labelledby="view-policy-network-label"
            chainIds={chainIds}
            value={activeChain}
            onChange={setSelectedChain}
          />
        </Field>
        <div className="grid gap-3">
          {installations.map(({ id, authorization }) => (
            <SessionPolicyCard key={id} name="Access duration" logo={lifetimeLogo}>
              <LifetimeSummary
                validAfter={authorization.validAfter}
                validUntil={authorization.validUntil}
              />
            </SessionPolicyCard>
          ))}
          {[...permissions].map(([key, { permission, chainIds: permissionChains }]) => (
            <OnchainPolicyCard key={key} permission={permission} chainIds={permissionChains} />
          ))}
          {installations.some(({ authorization }) => authorization.allowSignatures) ? (
            <SessionPolicyCard name="Onchain signature authority" logo={signatureLogo}>
              Signing enabled on this network
            </SessionPolicyCard>
          ) : null}
        </div>
        {sessionKey.policies.length > 0 ? (
          <section className="grid gap-3" aria-label="Shared API policies">
            <Typography.Heading level={3} className="text-base">
              Shared API policies
            </Typography.Heading>
            {sessionKey.policies.map((policy) => (
              <EvmPolicyDisplayCard key={policy.id} policy={policy} />
            ))}
          </section>
        ) : null}
      </div>
      <div className="max-w-2xl">
        <SessionKeyInstallations
          key={sessionKey.id}
          sessionKey={sessionKey}
          visibleChainId={activeChain}
        />
      </div>
    </section>
  );
}

export type { SessionKeyPoliciesProps };
