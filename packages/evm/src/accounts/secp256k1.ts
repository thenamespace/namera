import * as Signature from "ox/Signature";
import { hashMessage, hashTypedData, hexToBytes, type Hex, type LocalAccount } from "viem";
import { publicKeyToAddress } from "viem/accounts";
import { hashAuthorization } from "viem/utils";

import { derSignatureToEvmSignature } from "../signatures/der.js";

export type Secp256k1OwnerAccount = LocalAccount<"namera-secp256k1"> & {
  readonly signAuthorization: NonNullable<LocalAccount["signAuthorization"]>;
};

export interface CreateWalletKeySecp256k1AccountOptions {
  readonly publicKey: Hex;
  readonly sign: (hash: Uint8Array) => Promise<Uint8Array>;
}

export const createWalletKeySecp256k1Account = (
  options: CreateWalletKeySecp256k1AccountOptions,
): Secp256k1OwnerAccount => {
  const address = publicKeyToAddress(options.publicKey);
  const signHash = async (hash: Hex) =>
    derSignatureToEvmSignature({
      validatorType: "ecdsa_secp256k1",
      derSignature: await options.sign(hexToBytes(hash)),
      hash,
      publicKey: options.publicKey,
    });

  return {
    address,
    publicKey: options.publicKey,
    source: "namera-secp256k1",
    type: "local",
    sign: ({ hash }) => signHash(hash),
    signAuthorization: async (authorization) => {
      const contractAddress = authorization.contractAddress ?? authorization.address;
      const signature = Signature.fromHex(
        await signHash(
          hashAuthorization({
            address: contractAddress,
            chainId: authorization.chainId,
            nonce: authorization.nonce,
          }),
        ),
      );

      if (signature.yParity === undefined) {
        throw new Error("A secp256k1 authorization signature requires y parity");
      }

      return {
        address: contractAddress,
        chainId: authorization.chainId,
        nonce: authorization.nonce,
        r: signature.r,
        s: signature.s,
        yParity: signature.yParity,
      };
    },
    signMessage: ({ message }) => signHash(hashMessage(message)),
    signTypedData: (typedData) => signHash(hashTypedData(typedData)),
    signTransaction: async () => {
      throw new Error("Namera smart-account owners cannot sign EOA transactions");
    },
  };
};
