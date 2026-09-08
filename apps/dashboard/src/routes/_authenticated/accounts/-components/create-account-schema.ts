import { Schema } from "effect";

import { WalletMetadata, type MetadataIcon } from "@namera-ai/protocol/model";

import { OptionalFormDescription } from "@/lib/form-description";

export const defaultAccountLogo: MetadataIcon = { type: "emoji", value: "💳" };
export const CreateAccountFormValues = Schema.Struct({
  metadata: WalletMetadata.mapFields((fields) => ({
    ...fields,
    description: OptionalFormDescription,
  })),
  acknowledgeRecovery: Schema.Boolean,
}).check(
  Schema.makeFilter(({ acknowledgeRecovery }) =>
    acknowledgeRecovery
      ? undefined
      : {
          path: ["acknowledgeRecovery"],
          issue: "Acknowledge the passkey recovery limitation before creating an account.",
        },
  ),
);
export type CreateAccountFormValues = typeof CreateAccountFormValues.Type;
export type CreateAccountFormValuesEncoded = typeof CreateAccountFormValues.Encoded;

export const defaultAccountValues: CreateAccountFormValuesEncoded = {
  acknowledgeRecovery: false,
  metadata: {
    version: 1,
    name: "",
    logo: defaultAccountLogo,
    description: "",
  },
};
