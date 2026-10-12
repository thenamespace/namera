import { useMemo } from "react";

import type { SessionKeyResponse } from "@namera-ai/protocol/dto";
import { Typography } from "@namera-ai/ui";
import { Calendar03Icon, Globe02Icon, HugeiconsIcon } from "@namera-ai/ui/icons";

import { EvmPolicyDisplayCard } from "@/components/policy/evm";
import { LifetimeSummary } from "@/components/policy/evm/lifetime-summary";
import { NetworksSummary } from "@/components/policy/evm/networks-summary";
import { OnchainPolicyCard } from "@/components/policy/evm/onchain/display-card";
import { SessionPolicyCard } from "@/components/policy/evm/session-policy-card";
import { SessionKeyInstallations } from "@/components/session-key-installations";

import { groupInstallationLifetimes } from "./installation-lifetimes";
import { groupInstallationPermissions } from "./permission-groups";

const networksLogo = <HugeiconsIcon icon={Globe02Icon} />;
const lifetimeLogo = <HugeiconsIcon icon={Calendar03Icon} />;

type SessionKeyPoliciesProps = {
  sessionKey: SessionKeyResponse;
};

export function SessionKeyPolicies({ sessionKey }: SessionKeyPoliciesProps) {
  const permissions = groupInstallationPermissions(sessionKey.installations);
  const installationChainIds = useMemo(
    () => [...new Set(sessionKey.installations.map(({ chainId }) => chainId))],
    [sessionKey.installations],
  );
  const lifetimes = groupInstallationLifetimes(sessionKey.installations);
  return (
    <section className="mx-auto w-full max-w-5xl py-4 sm:px-2 sm:py-8">
      <div className="max-w-2xl">
        <Typography.Heading className="text-2xl tracking-tight" level={2}>
          Policies
        </Typography.Heading>
        <Typography.Paragraph className="mt-2 text-muted" size="sm">
          Transaction access and limits are enforced onchain. Signature rules apply through Namera;
          removing the onchain permission is required to stop signing outside Namera.
        </Typography.Paragraph>
      </div>
      <div className="mt-8 grid max-w-2xl gap-3">
        {installationChainIds.length ? (
          <SessionPolicyCard name="Networks" logo={networksLogo}>
            <NetworksSummary chainIds={installationChainIds} />
          </SessionPolicyCard>
        ) : null}
        {[...lifetimes].map(([key, lifetime]) => (
          <SessionPolicyCard key={key} name="Lifetime" logo={lifetimeLogo}>
            <div className="grid gap-1">
              {lifetimes.size > 1 ? <NetworksSummary chainIds={lifetime.chainIds} /> : null}
              <LifetimeSummary validAfter={lifetime.validAfter} validUntil={lifetime.validUntil} />
            </div>
          </SessionPolicyCard>
        ))}
        {[...permissions].map(([key, { permission, chainIds }]) => (
          <OnchainPolicyCard key={key} permission={permission} chainIds={chainIds} />
        ))}
        {sessionKey.policies.map((policy) => (
          <EvmPolicyDisplayCard key={policy.id} policy={policy} />
        ))}
      </div>
      <div className="max-w-2xl">
        <SessionKeyInstallations key={sessionKey.id} sessionKey={sessionKey} />
      </div>
    </section>
  );
}

export type { SessionKeyPoliciesProps };
