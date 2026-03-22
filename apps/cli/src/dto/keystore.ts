import { Schema } from "effect";

import { EthereumAddress } from "@/schema";

export const Keystore = Schema.Struct({
  version: Schema.Number,
  id: Schema.String,
  address: Schema.String,
  crypto: Schema.Any,
});

export const KeystoreData = Schema.Struct({
  path: Schema.String,
  alias: Schema.String,
  data: Keystore,
});

export const GetKeystoreParams = Schema.Struct({
  alias: Schema.String.annotate({
    description: "The alias of the wallet to retrieve",
  }),
});

export const ListKeystoreParams = Schema.Void;

export const CreateKeystoreParams = Schema.Struct({
  alias: Schema.String.annotate({
    description: "The alias of the wallet to create",
  }),
  password: Schema.redact(Schema.String).annotate({
    description: "The password to encrypt the keystore with",
  }),
});

export const DecryptKeystoreParams = Schema.Struct({
  alias: Schema.String.annotate({
    description: "The alias of the keystore to decrypt",
  }),
  password: Schema.redact(Schema.String).annotate({
    description: "The password to decrypt the keystore with",
  }),
});

export const DecryptKeystoreResponse = Schema.Struct({
  address: Schema.String.annotate({
    description: "The address of the keystore",
  }),
  alias: Schema.String.annotate({
    description: "The alias of the keystore",
  }),
  privateKey: Schema.Redacted(Schema.String).annotate({
    description: "The private key of the keystore",
  }),
  publicKey: Schema.String.annotate({
    description: "The public key of the keystore",
  }),
});

export const ImportKeystoreParams = Schema.Struct({
  alias: Schema.String.annotate({
    description: "The alias of the keystore to import",
  }),
  privateKey: Schema.String.annotate({
    description: "The private key of the keystore to import",
  }),
  password: Schema.redact(Schema.String).annotate({
    description: "The password to encrypt the keystore with",
  }),
});

export const RemoveKeystoreParams = Schema.Struct({
  alias: Schema.String.annotate({
    description: "The alias of the keystore to remove",
  }),
});

export const GetSignerParams = Schema.Struct({
  alias: Schema.String.annotate({
    description: "The alias of the keystore to get the signer for",
  }),
  password: Schema.redact(Schema.String).annotate({
    description: "The password to decrypt the keystore with",
  }),
});

export type Keystore = typeof Keystore.Type;
export type KeystoreData = typeof KeystoreData.Type;
export type GetKeystoreParams = typeof GetKeystoreParams.Type;
export type ListKeystoreParams = typeof ListKeystoreParams.Type;
export type CreateKeystoreParams = typeof CreateKeystoreParams.Type;
export type DecryptKeystoreParams = typeof DecryptKeystoreParams.Type;
export type DecryptKeystoreResponse = typeof DecryptKeystoreResponse.Type;
export type ImportKeystoreParams = typeof ImportKeystoreParams.Type;
export type RemoveKeystoreParams = typeof RemoveKeystoreParams.Type;
export type GetSignerParams = typeof GetSignerParams.Type;
