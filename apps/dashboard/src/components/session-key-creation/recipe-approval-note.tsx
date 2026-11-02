import type { SupportedEvmChainId } from "@namera-ai/protocol/evm";
import type { RecipeApproval } from "@namera-ai/recipes";
import { CopyIconButton, Disclosure, Typography } from "@namera-ai/ui";
import { ChainIcon } from "@namera-ai/ui/icons";

import { evmChainById } from "@/components/policy/evm/data";
import { showErrorToast } from "@/lib/toasts";

const copyError = () => showErrorToast(undefined, { title: "Couldn’t copy router address" });

export function RecipeApprovalNote({
  approval,
  networks,
}: {
  readonly approval: RecipeApproval;
  readonly networks: readonly SupportedEvmChainId[];
}) {
  const spenders = approval.spenders.filter((spender) => networks.includes(spender.chainId));

  return (
    <div className="grid min-w-0 gap-2">
      <Typography.Paragraph role="note" aria-label="Token approval" size="xs" color="muted">
        {approval.message}
      </Typography.Paragraph>
      <Disclosure>
        <Disclosure.Heading>
          <Disclosure.Trigger
            type="button"
            isDisabled={spenders.length === 0}
            className="w-auto justify-start gap-2 py-1 text-xs"
          >
            Router addresses
            <Disclosure.Indicator className="size-3" />
          </Disclosure.Trigger>
        </Disclosure.Heading>
        <Disclosure.Content>
          <Disclosure.Body className="p-0 pt-2">
            <ul className="grid gap-3" aria-label="Router addresses">
              {spenders.map(({ chainId, address }) => {
                const chain = evmChainById.get(chainId);
                return (
                  <li key={chainId} className="grid min-w-0 gap-1">
                    <span className="flex items-center gap-2 text-xs font-medium">
                      {chain ? (
                        <ChainIcon
                          aria-hidden
                          namespace="eip155"
                          chain={chain.chain}
                          className="size-3.5"
                        />
                      ) : null}
                      {chain?.name ?? chainId}
                    </span>
                    <div className="flex min-w-0 items-center gap-2">
                      <code className="min-w-0 break-all text-xs text-muted">{address}</code>
                      <CopyIconButton
                        label={`${chain?.name ?? chainId} router address`}
                        value={address}
                        onCopyError={copyError}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Disclosure.Body>
        </Disclosure.Content>
      </Disclosure>
    </div>
  );
}
