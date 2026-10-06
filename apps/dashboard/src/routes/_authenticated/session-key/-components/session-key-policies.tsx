import { Schema } from "effect";

import type { SessionKeyResponse } from "@namera-ai/protocol/dto";
import { EvmSessionPermission } from "@namera-ai/protocol/evm";
import { ItemCard, Typography } from "@namera-ai/ui";
import { HugeiconsIcon, ShieldUserIcon } from "@namera-ai/ui/icons";

import { EvmPolicyDisplayCard } from "@/components/policy/evm";
import { onchainPermissionCatalog } from "@/components/policy/evm/onchain/catalog";
import { OnchainPermissionSummary } from "@/components/policy/evm/onchain/summary";
import { SessionKeyInstallations } from "@/components/session-key-installations";

type SessionKeyPoliciesProps = {
  sessionKey: SessionKeyResponse;
};

export function SessionKeyPolicies({ sessionKey }: SessionKeyPoliciesProps) {
  const permissions = new Map(
    sessionKey.installations.flatMap((installation) =>
      installation.authorization.permissions.map((permission) => {
        const encoded = Schema.encodeSync(EvmSessionPermission)(permission);
        return [JSON.stringify(encoded), encoded] as const;
      }),
    ),
  );
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
      <div className="mt-8 grid max-w-3xl gap-3">
        {[...permissions].map(([key, permission]) => (
          <ItemCard key={key} variant="outline" className="rounded-lg border border-separator">
            {permission.type === "root" ? (
              <ItemCard.Icon className="self-start">
                <HugeiconsIcon icon={ShieldUserIcon} />
              </ItemCard.Icon>
            ) : null}
            <ItemCard.Content>
              <ItemCard.Title>{onchainPermissionCatalog[permission.type].name}</ItemCard.Title>
              <ItemCard.Description>
                <OnchainPermissionSummary permission={permission} />
              </ItemCard.Description>
            </ItemCard.Content>
          </ItemCard>
        ))}
        {sessionKey.policies.map((policy) => (
          <EvmPolicyDisplayCard key={policy.id} policy={policy} />
        ))}
      </div>
      <SessionKeyInstallations key={sessionKey.id} sessionKey={sessionKey} />
    </section>
  );
}

export type { SessionKeyPoliciesProps };
