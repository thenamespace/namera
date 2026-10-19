import { Schema } from "effect";

import { WalletId } from "@namera-ai/protocol";

const GettingStartedPreset = Schema.Literal("get-started");

export function validateSessionCreationSearch(search: Record<string, unknown>): {
  accountId?: WalletId;
  preset?: "get-started";
} {
  return {
    ...(Schema.is(WalletId)(search.accountId) ? { accountId: search.accountId } : {}),
    ...(Schema.is(GettingStartedPreset)(search.preset) ? { preset: search.preset } : {}),
  };
}
