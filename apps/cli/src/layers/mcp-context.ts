import { Context } from "effect";
import type { LocalAccount } from "viem";

import type { LocalSmartAccount, SessionKeyData } from "@/dto";

export type McpContext = {
  smartAccount: LocalSmartAccount;
  sessionKeys: (SessionKeyData & {
    signer: LocalAccount;
  })[];
};

export const McpContext = Context.Service<McpContext>(
  "@namera-ai/cli/McpContext",
);
