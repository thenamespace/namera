import { ServiceMap } from "effect";
import type { LocalAccount } from "viem";

import type { LocalSmartAccountData } from "./account";
import type { LocalSessionKeyData } from "./session-key";

export type CurrentMcpContextShape = {
  account: LocalSmartAccountData;
  sessionKeys: (LocalSessionKeyData & {
    signer: LocalAccount;
  })[];
};

export const CurrentMcpContext =
  ServiceMap.Service<CurrentMcpContextShape>("CurrentMcpContext");
