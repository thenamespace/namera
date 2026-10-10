import { Schema } from "effect";

import type {
  CreateSessionKeyRequest,
  SessionKeyResponse,
  WalletResponse,
} from "@namera-ai/protocol/dto";
import { CreateEvmSessionKeyPolicy } from "@namera-ai/protocol/model";
import { createLocalSessionBindings } from "@namera-ai/sdk";
import { isAddressEqual } from "viem";
import { publicKeyToAddress } from "viem/accounts";

type Registration = Pick<
  SessionKeyResponse,
  "id" | "walletId" | "signingKeyId" | "installations" | "status" | "policies"
> & {
  readonly wallet: Pick<WalletResponse, "id" | "address">;
};

export function recoverSessionRegistration<T extends Registration>(
  request: CreateSessionKeyRequest,
  wallet: Pick<WalletResponse, "id" | "address">,
  sessions: ReadonlyArray<T>,
) {
  if (request.signer.custody !== "local")
    throw new Error("Only local session registrations can be recovered from a public key");
  const signer = publicKeyToAddress(request.signer.publicKey);
  const candidates = sessions.filter((session) =>
    session.installations.some(({ authorization }) =>
      isAddressEqual(authorization.signerAddress, signer),
    ),
  );
  if (candidates.length === 0) return undefined;
  const [registration] = candidates;
  if (candidates.length !== 1 || !registration || registration.status !== "pending")
    throw new Error("The local signer does not identify one pending registration");
  // Recovery is not permission to adopt a server-provided configuration.
  createLocalSessionBindings({ request, wallet, registration });
  const encodePolicies = Schema.encodeSync(Schema.Array(CreateEvmSessionKeyPolicy));
  const recoveredPolicies = registration.policies.map(({ id: _id, ...policy }) => policy);
  if (
    JSON.stringify(encodePolicies(request.policies)) !==
    JSON.stringify(encodePolicies(recoveredPolicies))
  )
    throw new Error("Recovered API policies differ from the original request");
  return registration;
}
