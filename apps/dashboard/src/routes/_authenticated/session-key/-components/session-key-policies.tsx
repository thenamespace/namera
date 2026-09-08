import type { SessionKeyResponse } from "@namera-ai/protocol/dto";
import { Typography } from "@namera-ai/ui";

import { EvmPolicyDisplayCard } from "@/components/policy/evm";
import { SessionKeyInstallations } from "@/components/session-key-installations";

type SessionKeyPoliciesProps = {
  sessionKey: SessionKeyResponse;
};

export function SessionKeyPolicies({ sessionKey }: SessionKeyPoliciesProps) {
  return (
    <section className="mx-auto w-full max-w-5xl py-4 sm:px-2 sm:py-8">
      <div className="max-w-2xl">
        <Typography.Heading className="text-2xl tracking-tight" level={2}>
          Policies
        </Typography.Heading>
        <Typography.Paragraph className="mt-2 text-muted" size="sm">
          API rules apply to requests through Namera. Onchain permissions also constrain direct use
          of the session signer.
        </Typography.Paragraph>
      </div>
      <SessionKeyInstallations key={sessionKey.id} sessionKey={sessionKey} />

      <div className="mt-8 grid max-w-3xl gap-3">
        {sessionKey.policies.map((policy) => (
          <EvmPolicyDisplayCard key={policy.id} policy={policy} />
        ))}
      </div>
    </section>
  );
}

export type { SessionKeyPoliciesProps };
