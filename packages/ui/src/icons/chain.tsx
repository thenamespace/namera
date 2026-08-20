import type { ComponentType, SVGProps } from "react";

import type { EvmChainName } from "@namera-ai/protocol/evm";

import { ChainArbitrumIcon } from "./chain/arbitrum.js";
import { ChainBaseIcon } from "./chain/base.js";
import { ChainEthereumIcon } from "./chain/ethereum.js";
import { ChainOptimismIcon } from "./chain/optimism.js";

type SvgIcon = ComponentType<SVGProps<SVGSVGElement>>;

const evmChainIcons: Readonly<Record<EvmChainName, SvgIcon>> = {
  arbitrum: ChainArbitrumIcon,
  base: ChainBaseIcon,
  ethereum: ChainEthereumIcon,
  optimism: ChainOptimismIcon,
};

export type ChainIconProps = SVGProps<SVGSVGElement> & {
  readonly namespace: "eip155";
  readonly chain: EvmChainName;
};

export const ChainIcon = ({ namespace, chain, ...props }: ChainIconProps) => {
  switch (namespace) {
    case "eip155": {
      const Icon = evmChainIcons[chain];
      return <Icon {...props} />;
    }
  }
};
