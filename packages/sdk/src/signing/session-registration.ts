import { DateTime, Schema } from "effect";

import type {
  CreateSessionKeyRequest,
  CreateSessionKeyResponse,
  WalletResponse,
} from "@namera-ai/protocol/dto";
import { EvmSessionPermissions } from "@namera-ai/protocol/evm";
import { LocalEvmSessionBinding } from "@namera-ai/protocol/local";
import { isAddressEqual } from "viem";
import { publicKeyToAddress } from "viem/accounts";

export class LocalSessionRegistrationError extends Schema.TaggedError<LocalSessionRegistrationError>()(
  "LocalSessionRegistrationError",
  { code: Schema.Literals(["IDENTITY_MISMATCH", "NETWORK_MISMATCH", "PERMISSION_MISMATCH"]) },
) {}

type Registration = Pick<
  CreateSessionKeyResponse,
  "id" | "walletId" | "signingKeyId" | "installations"
> & {
  readonly wallet: Pick<WalletResponse, "id" | "address">;
};

/** Validate registration against local choices. This does not prove onchain installation. */
export const createLocalSessionBindings = ({
  request,
  wallet,
  registration,
}: {
  readonly request: CreateSessionKeyRequest;
  readonly wallet: Pick<WalletResponse, "id" | "address">;
  readonly registration: Registration;
}): ReadonlyArray<LocalEvmSessionBinding> => {
  if (
    request.walletId !== wallet.id ||
    registration.walletId !== wallet.id ||
    registration.wallet.id !== wallet.id ||
    !isAddressEqual(registration.wallet.address, wallet.address)
  )
    throw new LocalSessionRegistrationError({ code: "IDENTITY_MISMATCH" });

  const chains = new Set(request.onchain.chains);
  if (registration.installations.length !== chains.size)
    throw new LocalSessionRegistrationError({ code: "NETWORK_MISMATCH" });

  const signerAddress = publicKeyToAddress(request.signer.publicKey);
  const encodePermissions = Schema.encodeSync(EvmSessionPermissions);
  const expectedPermissions = JSON.stringify(encodePermissions(request.onchain.permissions));
  const bindings = registration.installations.map((installation) => {
    if (!chains.delete(installation.chainId))
      throw new LocalSessionRegistrationError({ code: "NETWORK_MISMATCH" });

    const authorization = installation.authorization;
    if (!isAddressEqual(authorization.signerAddress, signerAddress))
      throw new LocalSessionRegistrationError({ code: "IDENTITY_MISMATCH" });
    if (
      authorization.validAfter !== request.onchain.validAfter ||
      authorization.validUntil !== request.onchain.validUntil ||
      (authorization.allowSignatures === true) !== (request.onchain.allowSignatures === true) ||
      JSON.stringify(encodePermissions(authorization.permissions)) !== expectedPermissions
    )
      throw new LocalSessionRegistrationError({ code: "PERMISSION_MISMATCH" });

    return Schema.decodeUnknownSync(LocalEvmSessionBinding)({
      walletId: wallet.id,
      walletAddress: wallet.address,
      sessionKeyId: registration.id,
      signingKeyId: registration.signingKeyId,
      installationId: installation.id,
      chainId: installation.chainId,
      signerAddress,
      entityId: authorization.entityId,
      isGlobal: request.onchain.permissions.some((permission) => permission.type === "root"),
      // Alchemy v2 attaches execution hooks only for native/ERC-20 spend permissions.
      // Gas, time and target/selector restrictions are validation hooks.
      hasExecutionHooks: request.onchain.permissions.some(
        (permission) =>
          permission.type === "native-token-transfer" || permission.type === "erc20-token-transfer",
      ),
      allowSignatures: request.onchain.allowSignatures === true,
      validAfter: DateTime.formatIso(DateTime.makeUnsafe(request.onchain.validAfter * 1000)),
      validUntil: DateTime.formatIso(DateTime.makeUnsafe(request.onchain.validUntil * 1000)),
    });
  });
  return bindings;
};
