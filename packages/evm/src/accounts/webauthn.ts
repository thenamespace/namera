import * as Base64 from "ox/Base64";
import * as Hex from "ox/Hex";
import * as Signature from "ox/Signature";
import * as Authentication from "ox/webauthn/Authentication";
import * as WebAuthnP256 from "ox/WebAuthnP256";
import { hashMessage, hashTypedData } from "viem";
import type { Hex as ViemHex } from "viem";
import type { WebAuthnAccount, WebAuthnSignReturnType } from "viem/account-abstraction";

export interface CreateWalletKeyWebAuthnAccountOptions {
  readonly id: string;
  readonly publicKey: ViemHex;
  readonly origin: string;
  readonly rpId: string;
  readonly sign: (payload: Uint8Array) => Promise<Uint8Array>;
}

export const createWalletKeyWebAuthnAccount = (
  options: CreateWalletKeyWebAuthnAccountOptions,
): WebAuthnAccount => {
  const sign = async (hash: ViemHex): Promise<WebAuthnSignReturnType> => {
    const { metadata, payload } = WebAuthnP256.getSignPayload({
      challenge: hash,
      origin: options.origin,
      rpId: options.rpId,
    });
    const derSignature = await options.sign(Hex.toBytes(payload));
    const signature = Signature.fromDerBytes(derSignature);
    const rawResponse = {
      authenticatorData: Base64.fromHex(metadata.authenticatorData, { pad: false, url: true }),
      clientDataJSON: Base64.fromString(metadata.clientDataJSON, { pad: false, url: true }),
      signature: Base64.fromBytes(derSignature, { pad: false, url: true }),
      userHandle: Base64.fromBytes(new Uint8Array(), { pad: false, url: true }),
    };
    const response = Authentication.deserializeResponse({
      id: options.id,
      metadata,
      raw: {
        id: options.id,
        type: "public-key",
        authenticatorAttachment: null,
        rawId: options.id,
        response: rawResponse,
      },
      signature: Signature.toHex(signature),
    });

    return {
      signature: Signature.toHex(signature),
      webauthn: metadata,
      raw: response.raw,
    };
  };

  return {
    id: options.id,
    publicKey: options.publicKey,
    sign: ({ hash }) => sign(hash),
    signMessage: ({ message }) => sign(hashMessage(message)),
    signTypedData: (typedData) => sign(hashTypedData(typedData)),
    type: "webAuthn",
  };
};
