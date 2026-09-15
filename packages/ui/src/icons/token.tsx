import type { ComponentType, SVGProps } from "react";

import { ChainEthereumIcon } from "./chain/ethereum.js";
import { TokenDaiIcon } from "./token/dai.js";
import { TokenUsdcIcon } from "./token/usdc.js";
import { TokenWethIcon } from "./token/weth.js";

type SvgIcon = ComponentType<SVGProps<SVGSVGElement>>;

export type TokenSymbol = "DAI" | "ETH" | "USDC" | "WETH";

/*
 * Native ETH has no token mark of its own — it is the chain — so it borrows the
 * Ethereum chain icon, which is what the assets table already does.
 */
const tokenIcons: Readonly<Record<TokenSymbol, SvgIcon>> = {
  DAI: TokenDaiIcon,
  ETH: ChainEthereumIcon,
  USDC: TokenUsdcIcon,
  WETH: TokenWethIcon,
};

export type TokenIconProps = SVGProps<SVGSVGElement> & {
  readonly symbol: TokenSymbol;
};

export const TokenIcon = ({ symbol, ...props }: TokenIconProps) => {
  const Icon = tokenIcons[symbol];
  return <Icon {...props} />;
};
