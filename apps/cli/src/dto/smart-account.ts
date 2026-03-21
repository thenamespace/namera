import { Schema } from "effect";

import {
  EntrypointVersion,
  EthereumAddress,
  KernelVersion,
  OwnerType,
} from "@/schema";
import { SupportedChain } from "@/schema/chain";

export const LocalSmartAccount = Schema.Struct({
  entryPointVersion: EntrypointVersion,
  index: Schema.Number,
  kernelVersion: KernelVersion,
  ownerAlias: Schema.String,
  ownerType: OwnerType,
  smartAccountAddress: EthereumAddress,
});

export const LocalSmartAccountData = Schema.Struct({
  data: LocalSmartAccount,
  path: Schema.String,
  alias: Schema.String,
});

export const CreateSmartAccountParams = Schema.Struct({
  alias: Schema.String.annotate({
    description: "The alias of the smart account to create",
  }),
  ownerAlias: Schema.String.annotate({
    description: "The alias of the owner keystore",
  }),
  index: Schema.optional(
    Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  ).annotate({
    description: "The index of the smart account",
    default: 0,
  }),
});

export const GetSmartAccountParams = Schema.Struct({
  alias: Schema.String.annotate({
    description: "The alias of the smart account to retrieve",
  }),
});
export const ListSmartAccountParams = Schema.Void;

export const GetSmartAccountInfoParams = Schema.Struct({
  alias: Schema.String.annotate({
    description: "The alias of the smart account to retrieve",
  }),
});

export const RemoveSmartAccountParams = Schema.Struct({
  alias: Schema.String.annotate({
    description: "The alias of the smart account to remove",
  }),
});

export const GetSmartAccountStatusParams = Schema.Struct({
  alias: Schema.String.annotate({
    description: "The alias of the smart account",
  }),
  chain: SupportedChain.annotate({
    description: "The chain to get the status for",
  }),
  rpcUrl: Schema.redact(Schema.String.pipe(Schema.optional)).annotate({
    description: "The RPC URL to use for the chain",
    default: "Public RPC URL",
  }),
});

export const ImportSmartAccountParams = LocalSmartAccount.pipe(
  Schema.fieldsAssign({
    alias: Schema.String.annotate({
      description: "The alias of the smart account to import",
    }),
  }),
);

export type LocalSmartAccount = typeof LocalSmartAccount.Type;
export type LocalSmartAccountData = typeof LocalSmartAccountData.Type;
export type CreateSmartAccountParams = typeof CreateSmartAccountParams.Type;
export type GetSmartAccountParams = typeof GetSmartAccountParams.Type;
export type ListSmartAccountParams = typeof ListSmartAccountParams.Type;
export type GetSmartAccountInfoParams = typeof GetSmartAccountInfoParams.Type;
export type RemoveSmartAccountParams = typeof RemoveSmartAccountParams.Type;
export type GetSmartAccountStatusParams =
  typeof GetSmartAccountStatusParams.Type;

export type ImportSmartAccountParams = typeof ImportSmartAccountParams.Type;
