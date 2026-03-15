import { ServiceMap } from "effect";
import type { LocalAccount } from "viem";

import type { LocalSmartAccountData } from "./account";
import type { LocalSessionKey } from "./session-key";

export type CurrentMcpContextShape = {
  account: LocalSmartAccountData;
  sessionKeys: (LocalSessionKey & {
    signer: LocalAccount;
  })[];
};

export const CurrentMcpContext =
  ServiceMap.Service<CurrentMcpContextShape>("CurrentMcpContext");
