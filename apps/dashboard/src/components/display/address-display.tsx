import type { EthereumAddress } from "@namera-ai/protocol/evm";
import { Tooltip } from "@namera-ai/ui";

type AddressDisplayProps = {
  address: EthereumAddress;
};

export function AddressDisplay({ address }: AddressDisplayProps) {
  return (
    <Tooltip delay={300}>
      <Tooltip.Trigger
        aria-label={`Account address ${address}`}
        className="text-muted cursor-help font-mono text-xs"
      >
        {address.slice(0, 8)}…{address.slice(-6)}
      </Tooltip.Trigger>
      <Tooltip.Content className="font-mono text-xs" showArrow>
        <Tooltip.Arrow />
        {address}
      </Tooltip.Content>
    </Tooltip>
  );
}

export type { AddressDisplayProps };
