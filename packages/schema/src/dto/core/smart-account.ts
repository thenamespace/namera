import { Schema } from "effect";

import { SmartAccount } from "@/core";

export const CreateSmartAccountPayload = SmartAccount.pick(
  "name",
  "ownerIdentifier",
  "ownerType",
);

export type CreateSmartAccountPayload = typeof CreateSmartAccountPayload.Type;

export const ListSmartAccountsResponse = Schema.Struct({
  accounts: Schema.Array(SmartAccount),
});

export type ListSmartAccountsResponse = typeof ListSmartAccountsResponse.Type;
