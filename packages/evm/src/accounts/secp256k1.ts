import * as Secp256k1 from "ox/Secp256k1";
import * as Signature from "ox/Signature";
import { hashMessage, hashTypedData, hexToBytes, type Hex, type LocalAccount } from "viem";
import { publicKeyToAddress } from "viem/accounts";
import { hashAuthorization } from "viem/utils";

import { derSignatureToEvmSignature } from "../signatures/der.js";
import { recoverableSignatureToEvmSignature } from "../signatures/recoverable.js";

export type Secp256k1OwnerAccount = LocalAccount<"namera-secp256k1"> & {
  readonly signAuthorization: NonNullable<LocalAccount["signAuthorization"]>;
};

export interface CreateWalletKeySecp256k1AccountOptions {
  readonly publicKey: Hex;
  readonly sign: (hash: Uint8Array) => Promise<Uint8Array>;
  readonly signatureEncoding?: "der" | "recoverable";
}

export const createSecp256k1OwnerAccount = (
  options: CreateWalletKeySecp256k1AccountOptions,
): LocalAccount<"namera-secp256k1"> & { readonly sign: NonNullable<LocalAccount["sign"]> } => {
  if (options.publicKey.length !== 132 || !options.publicKey.startsWith("0x04")) {
    throw new Error("An uncompressed secp256k1 public key is required");
  }
  Secp256k1.noble.Point.fromHex(options.publicKey.slice(2)).assertValidity();
  const address = publicKeyToAddress(options.publicKey);
  const signHash = async (hash: Hex) => {
    if (hash.length !== 66) throw new Error("Owner signing requires a 32-byte digest");
    const signature = await options.sign(hexToBytes(hash));
    return options.signatureEncoding === "recoverable"
      ? recoverableSignatureToEvmSignature({ signature, hash, publicKey: options.publicKey })
      : derSignatureToEvmSignature({
          validatorType: "ecdsa_secp256k1",
          derSignature: signature,
          hash,
          publicKey: options.publicKey,
        });
  };

  return {
    address,
    publicKey: options.publicKey,
    source: "namera-secp256k1",
    type: "local",
    sign: ({ hash }) => signHash(hash),
    signMessage: ({ message }) => signHash(hashMessage(message)),
    signTypedData: (typedData) => signHash(hashTypedData(typedData)),
    signTransaction: async () => {
      throw new Error("Namera smart-account owners cannot sign EOA transactions");
    },
  };
};

/** Legacy 7702 owners explicitly opt into authorization signing. */
export const createWalletKeySecp256k1Account = (
  options: CreateWalletKeySecp256k1AccountOptions,
): Secp256k1OwnerAccount => {
  const account = createSecp256k1OwnerAccount(options);
  return {
    ...account,
    signAuthorization: async (authorization) => {
      const contractAddress = authorization.contractAddress ?? authorization.address;
      const signature = Signature.fromHex(
        await account.sign({
          hash: hashAuthorization({
            address: contractAddress,
            chainId: authorization.chainId,
            nonce: authorization.nonce,
          }),
        }),
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
  };
};
