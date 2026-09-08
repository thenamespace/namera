import { Schema } from "effect";

import { SigningKeyId, VerificationId, WalletId } from "#/common/index";
import { Hex } from "#/evm/index";
import { NonEmptyString } from "#/model/common";

const Base64UrlString = Schema.String.check(
  Schema.isPattern(/^[A-Za-z0-9_-]+$/, { message: "Expected an unpadded base64url value" }),
  Schema.isMinLength(1),
);

export const GetWalletPasskeyOwnerResponse = Schema.Struct({
  walletId: WalletId,
  owner: Schema.NullOr(
    Schema.Struct({
      signingKeyId: SigningKeyId,
      publicKeyHex: Hex,
      credentialId: Base64UrlString,
      rpId: NonEmptyString,
    }),
  ),
}).annotate({
  identifier: "GetWalletPasskeyOwnerResponse",
  description:
    "Public passkey data for independent owner-operation review. User-only; owner is null for non-passkey wallets. No signing capability is returned.",
});

export type GetWalletPasskeyOwnerResponse = typeof GetWalletPasskeyOwnerResponse.Type;

const PublicKeyCredentialDescriptor = Schema.Struct({
  id: Base64UrlString,
  type: Schema.Literal("public-key"),
  transports: Schema.optionalKey(Schema.Array(Schema.String)),
});

export const PasskeyAuthenticationOptions = Schema.Struct({
  challenge: Base64UrlString,
  rpId: NonEmptyString,
  timeout: Schema.Int.check(Schema.isGreaterThan(0)),
  allowCredentials: Schema.Array(PublicKeyCredentialDescriptor),
  userVerification: Schema.Literal("required"),
}).annotate({ identifier: "PasskeyAuthenticationOptions" });

export const PasskeyAuthenticationResponse = Schema.Struct({
  id: Base64UrlString,
  rawId: Base64UrlString,
  type: Schema.Literal("public-key"),
  response: Schema.Struct({
    clientDataJSON: Base64UrlString,
    authenticatorData: Base64UrlString,
    signature: Base64UrlString,
    userHandle: Schema.optionalKey(Base64UrlString),
  }),
  authenticatorAttachment: Schema.optionalKey(Schema.Literals(["cross-platform", "platform"])),
  clientExtensionResults: Schema.Struct({}),
}).annotate({ identifier: "PasskeyAuthenticationResponse" });

export const PasskeyRegistrationOptions = Schema.Struct({
  challenge: Base64UrlString,
  rp: Schema.Struct({
    id: NonEmptyString,
    name: NonEmptyString,
  }),
  user: Schema.Struct({
    id: Base64UrlString,
    name: NonEmptyString,
    displayName: NonEmptyString,
  }),
  pubKeyCredParams: Schema.Array(
    Schema.Struct({
      alg: Schema.Int,
      type: Schema.Literal("public-key"),
    }),
  ),
  timeout: Schema.Int.check(Schema.isGreaterThan(0)),
  excludeCredentials: Schema.Array(PublicKeyCredentialDescriptor),
  authenticatorSelection: Schema.Struct({
    residentKey: Schema.Literal("required"),
    requireResidentKey: Schema.Literal(true),
    userVerification: Schema.Literal("required"),
  }),
  hints: Schema.Array(Schema.Literals(["security-key", "client-device", "hybrid"])),
  attestation: Schema.Literal("none"),
  extensions: Schema.Struct({
    credProps: Schema.Literal(true),
  }),
});

export const PasskeyRegistrationOptionsResponse = Schema.Struct({
  verificationId: VerificationId,
  options: PasskeyRegistrationOptions,
  expiresAt: Schema.DateTimeUtcFromDate,
}).annotate({
  identifier: "PasskeyRegistrationOptionsResponse",
  description: "A tenant-bound, one-time WebAuthn registration ceremony",
});

export const PasskeyRegistrationResponse = Schema.Struct({
  id: Base64UrlString,
  rawId: Base64UrlString,
  response: Schema.Struct({
    clientDataJSON: Base64UrlString,
    attestationObject: Base64UrlString,
    authenticatorData: Schema.optionalKey(Base64UrlString),
    transports: Schema.optionalKey(Schema.Array(Schema.String)),
    publicKeyAlgorithm: Schema.optionalKey(Schema.Int),
    publicKey: Schema.optionalKey(Base64UrlString),
  }),
  authenticatorAttachment: Schema.optionalKey(Schema.Literals(["cross-platform", "platform"])),
  clientExtensionResults: Schema.Struct({
    credProps: Schema.optionalKey(Schema.Struct({ rk: Schema.optionalKey(Schema.Boolean) })),
  }),
  type: Schema.Literal("public-key"),
}).annotate({
  identifier: "PasskeyRegistrationResponse",
  description: "The browser WebAuthn registration response for a wallet owner",
});

export type PasskeyRegistrationOptions = typeof PasskeyRegistrationOptions.Type;
export type PasskeyRegistrationOptionsResponse = typeof PasskeyRegistrationOptionsResponse.Type;
export type PasskeyRegistrationResponse = typeof PasskeyRegistrationResponse.Type;
