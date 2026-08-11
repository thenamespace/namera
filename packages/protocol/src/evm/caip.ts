import { Schema } from "effect";

export const Caip2ChainId = Schema.String.check(
  Schema.isPattern(/^[-a-z0-9]{3,8}:[-_a-zA-Z0-9]{1,32}$/, {
    message: "Invalid CAIP-2 chain ID",
  }),
)
  .pipe(Schema.brand("Caip2ChainId"))
  .annotate({
    identifier: "Caip2ChainId",
    description: "A CAIP-2 blockchain identifier",
  });

export const Caip10AccountId = Schema.String.check(
  Schema.isPattern(/^[-a-z0-9]{3,8}:[-_a-zA-Z0-9]{1,32}:[-.%a-zA-Z0-9]{1,128}$/, {
    message: "Invalid CAIP-10 account ID",
  }),
)
  .pipe(Schema.brand("Caip10AccountId"))
  .annotate({
    identifier: "Caip10AccountId",
    description: "A CAIP-10 blockchain account identifier",
  });

export const Eip155ChainId = Caip2ChainId.check(
  Schema.isPattern(/^eip155:(0|[1-9][0-9]{0,31})$/, {
    message: "Invalid EIP-155 CAIP-2 chain ID",
  }),
)
  .pipe(Schema.brand("Eip155ChainId"))
  .annotate({
    identifier: "Eip155ChainId",
    description: "A CAIP-2 identifier in the EIP-155 namespace",
  });

export const Eip155AccountId = Caip10AccountId.check(
  Schema.isPattern(/^eip155:(0|[1-9][0-9]{0,31}):0x[0-9a-fA-F]{40}$/, {
    message: "Invalid EIP-155 CAIP-10 account ID",
  }),
)
  .pipe(Schema.brand("Eip155AccountId"))
  .annotate({
    identifier: "Eip155AccountId",
    description: "A CAIP-10 account identifier in the EIP-155 namespace",
  });

export type Caip2ChainId = typeof Caip2ChainId.Type;
export type Caip10AccountId = typeof Caip10AccountId.Type;
export type Eip155ChainId = typeof Eip155ChainId.Type;
export type Eip155AccountId = typeof Eip155AccountId.Type;
