import { Schema } from "effect";

import type {
  CreateSessionKeyRequest,
  CreateSessionKeyResponse,
  WalletResponse,
} from "@namera-ai/protocol/dto";
import { CreateEvmSessionKeyPolicy } from "@namera-ai/protocol/model";
import { createLocalSessionBindings } from "@namera-ai/sdk";

export function validateManagedRegistration(
  request: CreateSessionKeyRequest,
  wallet: Pick<WalletResponse, "id" | "address">,
  registration: Pick<
    CreateSessionKeyResponse,
    "id" | "walletId" | "signingKeyId" | "installations" | "signer" | "status" | "policies"
  > & { readonly wallet: Pick<WalletResponse, "id" | "address"> },
) {
  if (
    request.signer.custody !== "namera-managed" ||
    registration.signer.custody !== "namera-managed" ||
    registration.signer.provider !== request.signer.provider ||
    registration.status !== "pending"
  ) {
    throw new Error("Managed session registration does not match requested custody");
  }
  // Reuse the public installation verifier, without retaining or exporting local bindings.
  // A managed key has no caller-selected public key; its returned public identity must
  // nevertheless match every installation before owner approval is offered.
  createLocalSessionBindings({
    request: {
      ...request,
      signer: {
        custody: "local",
        algorithm: "secp256k1",
        publicKey: registration.signer.publicKey,
      },
    },
    wallet,
    registration,
  });
  const encode = Schema.encodeSync(Schema.Array(CreateEvmSessionKeyPolicy));
  if (
    JSON.stringify(encode(request.policies)) !==
    JSON.stringify(encode(registration.policies.map(({ id: _id, ...policy }) => policy)))
  ) {
    throw new Error("Managed session policies differ from the request");
  }
}
