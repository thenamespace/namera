import { Schema } from "effect";

import { WalletMetadata, type MetadataIcon } from "@namera-ai/protocol/model";

import { OptionalFormDescription } from "@/lib/form-description";

export const defaultAccountLogo: MetadataIcon = { type: "emoji", value: "💳" };
export const CreateAccountFormValues = Schema.Struct({
  ownership: Schema.Literals(["local", "1claw"]),
  metadata: WalletMetadata.mapFields((fields) => ({
    ...fields,
    description: OptionalFormDescription,
  })),
});
export type CreateAccountFormValues = typeof CreateAccountFormValues.Type;
export type CreateAccountFormValuesEncoded = typeof CreateAccountFormValues.Encoded;

export const defaultAccountValues: CreateAccountFormValuesEncoded = {
  ownership: "local",
  metadata: {
    version: 1,
    name: "",
    logo: defaultAccountLogo,
    description: "",
  },
};
