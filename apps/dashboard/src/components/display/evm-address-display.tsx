import type { KeyboardEvent } from "react";

import type { EthereumAddress } from "@namera-ai/protocol/evm";
import { Avatar, Tooltip } from "@namera-ai/ui";
import { useEventCallback } from "usehooks-ts";
import { useEnsAvatar, useEnsName } from "wagmi";
import { mainnet } from "wagmi/chains";

import { showErrorToast, showSuccessToast } from "@/lib/toasts";

type EvmAddressDisplayProps = {
  address: EthereumAddress;
};

export function EvmAddressDisplay({ address }: EvmAddressDisplayProps) {
  const { data: ensName } = useEnsName({
    address,
    chainId: mainnet.id,
    query: { staleTime: 60 * 60 * 1000 },
  });

  const { data: ensAvatar } = useEnsAvatar({
    chainId: mainnet.id,
    name: ensName ?? undefined,
    query: {
      enabled: ensName !== null && ensName !== undefined,
      staleTime: 60 * 60 * 1000,
    },
  });

  const placeholderAvatar = `https://api.dicebear.com/10.x/glass/svg?seed=${address}&size=40`;

  const copyAddress = useEventCallback(() => {
    void navigator.clipboard.writeText(address).then(
      () =>
        showSuccessToast({
          title: "Address copied to clipboard",
        }),
      () => showErrorToast(undefined, { title: "Couldn't copy address" }),
    );
  });

  const handleKeyDown = useEventCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    copyAddress();
  });

  return (
    <Tooltip delay={300}>
      <Tooltip.Trigger
        aria-label={`Copy account address ${address}`}
        className="text-muted hover:text-foreground inline-flex cursor-copy items-center gap-2 transition-colors"
        onClick={copyAddress}
        onKeyDown={handleKeyDown}
      >
        {ensName ? (
          <>
            <Avatar className="size-4.5 shrink-0">
              <Avatar.Image alt="" src={ensAvatar ?? placeholderAvatar} />
            </Avatar>
            <span className="text-md">{ensName}</span>
          </>
        ) : (
          <span className="font-mono text-xs">
            {address.slice(0, 8)}…{address.slice(-6)}
          </span>
        )}
      </Tooltip.Trigger>
      <Tooltip.Content className="font-mono text-xs" showArrow>
        <Tooltip.Arrow />
        {address}
      </Tooltip.Content>
    </Tooltip>
  );
}

export type { EvmAddressDisplayProps };
