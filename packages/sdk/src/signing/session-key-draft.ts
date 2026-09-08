import { Redacted, Schema } from "effect";

import type { CreateSessionKeyRequest } from "@namera-ai/protocol/dto";
import { EthereumAddress } from "@namera-ai/protocol/evm";
import {
  LocalSessionKeyMaterial,
  type EncryptedLocalSessionKey,
  type LocalEvmSessionBinding,
} from "@namera-ai/protocol/local";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import { sealLocalSessionKey } from "./keystore.js";

export class LocalSessionKeyDraftError extends Schema.TaggedError<LocalSessionKeyDraftError>()(
  "LocalSessionKeyDraftError",
  { code: Schema.Literals(["GENERATION_FAILED", "DRAFT_DISPOSED"]) },
) {}

export type LocalSessionKeyDraft = {
  readonly signer: CreateSessionKeyRequest["signer"];
  readonly signerAddress: typeof EthereumAddress.Type;
  /** Bindings must come from the owner's reviewed approval, never a signing challenge. */
  readonly seal: (
    apiOrigin: string,
    bindings: ReadonlyArray<LocalEvmSessionBinding>,
    password: Redacted.Redacted<string>,
  ) => Promise<EncryptedLocalSessionKey>;
  readonly dispose: () => void;
};

/** Keep this handle in a component ref, not serializable form/atom state or storage. */
export const createLocalSessionKeyDraft = (): LocalSessionKeyDraft => {
  let privateKey: Redacted.Redacted<`0x${string}`> | undefined;
  try {
    privateKey = Schema.decodeUnknownSync(LocalSessionKeyMaterial.fields.privateKey)(
      generatePrivateKey(),
    );
    const { publicKey, address } = privateKeyToAccount(Redacted.value(privateKey));
    const signer = Object.freeze({
      custody: "local" as const,
      algorithm: "secp256k1" as const,
      publicKey,
    });

    return Object.freeze({
      signer,
      signerAddress: Schema.decodeUnknownSync(EthereumAddress)(address),
      async seal(apiOrigin, bindings, password) {
        if (privateKey === undefined)
          throw new LocalSessionKeyDraftError({ code: "DRAFT_DISPOSED" });

        const envelope = await sealLocalSessionKey(
          { version: 1, namespace: "eip155", apiOrigin, privateKey, bindings },
          password,
        );
        // Unmount/discard may happen while WebCrypto is working. Do not deliver
        // an export to a cancelled flow, even if encryption already completed.
        if (privateKey === undefined)
          throw new LocalSessionKeyDraftError({ code: "DRAFT_DISPOSED" });
        return envelope;
      },
      dispose() {
        if (privateKey !== undefined) Redacted.wipeUnsafe(privateKey);
        privateKey = undefined;
      },
    } satisfies LocalSessionKeyDraft);
  } catch {
    if (privateKey !== undefined) Redacted.wipeUnsafe(privateKey);
    throw new LocalSessionKeyDraftError({ code: "GENERATION_FAILED" });
  }
};
