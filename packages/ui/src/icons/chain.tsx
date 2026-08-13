import type { ComponentType, SVGProps } from "react";

import type { EvmChainName } from "@namera-ai/protocol/evm";

import { ChainArbitrumIcon } from "./chain/arbitrum.js";
import { ChainAvalancheIcon } from "./chain/avalanche.js";
import { ChainBaseIcon } from "./chain/base.js";
import { ChainCeloIcon } from "./chain/celo.js";
import { ChainEthereumIcon } from "./chain/ethereum.js";
import { ChainOptimismIcon } from "./chain/optimism.js";
import { ChainPolygonIcon } from "./chain/polygon.js";
import { ChainScrollIcon } from "./chain/scroll.js";

type SvgIcon = ComponentType<SVGProps<SVGSVGElement>>;

const PlaceholderChainIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 32 32"
    {...props}
  >
    <circle cx="16" cy="16" r="15" stroke="currentColor" strokeWidth="2" />
    <path stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="M10 16h12M16 10v12" />
  </svg>
);

const evmChainIcons: Readonly<Record<EvmChainName, SvgIcon>> = {
  arbitrum: ChainArbitrumIcon,
  arc: PlaceholderChainIcon,
  avalanche: ChainAvalancheIcon,
  base: ChainBaseIcon,
  celo: ChainCeloIcon,
  ethereum: ChainEthereumIcon,
  "hyper-evm": PlaceholderChainIcon,
  megaeth: PlaceholderChainIcon,
  monad: PlaceholderChainIcon,
  optimism: ChainOptimismIcon,
  polygon: ChainPolygonIcon,
  scroll: ChainScrollIcon,
  tempo: PlaceholderChainIcon,
  unichain: PlaceholderChainIcon,
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
