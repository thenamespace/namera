import { chains } from "@namera-ai/evm/chains";
import { createConfig, http } from "wagmi";
import { type Chain } from "wagmi/chains";

import { env } from "@/env";

const transports = Object.fromEntries(
  Object.values(chains).map((data) => {
    return [data.chain.id, http(`${env.backendUrl}/rpc/eip155/${data.chain.id}`)];
  }),
);

export const wagmiConfig = createConfig({
  chains: Object.values(chains).map((data) => data.chain) as [Chain, ...Chain[]],
  transports,
});
