import { Schema } from "effect";

import { WalletId } from "@namera-ai/protocol";

const GettingStarted = Schema.Literal("get-started");

export function validateSessionCreationSource(search: Record<string, unknown>): {
  from?: "get-started";
} {
  return Schema.is(GettingStarted)(search.from) ? { from: search.from } : {};
}

export function validateSessionCreationSearch(search: Record<string, unknown>): {
  accountId?: WalletId;
  preset?: "get-started";
  from?: "get-started";
} {
  return {
    ...(Schema.is(WalletId)(search.accountId) ? { accountId: search.accountId } : {}),
    ...(Schema.is(GettingStarted)(search.preset) ? { preset: search.preset } : {}),
    ...validateSessionCreationSource(search),
  };
}
