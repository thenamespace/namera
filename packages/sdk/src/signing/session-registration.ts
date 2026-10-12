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
  {
    code: Schema.Literals([
      "IDENTITY_MISMATCH",
      "NETWORK_MISMATCH",
      "PERMISSION_MISMATCH",
      "UNSUPPORTED_CUSTODY",
    ]),
  },
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
  if (request.signer.custody !== "local")
    throw new LocalSessionRegistrationError({ code: "UNSUPPORTED_CUSTODY" });
  if (
    request.walletId !== wallet.id ||
    registration.walletId !== wallet.id ||
    registration.wallet.id !== wallet.id ||
    !isAddressEqual(registration.wallet.address, wallet.address)
  )
    throw new LocalSessionRegistrationError({ code: "IDENTITY_MISMATCH" });

  const requested = new Map(
    request.onchain.installations.map((installation) => [installation.chainId, installation]),
  );
  if (
    requested.size !== request.onchain.installations.length ||
    registration.installations.length !== requested.size
  )
    throw new LocalSessionRegistrationError({ code: "NETWORK_MISMATCH" });

  const signerAddress = publicKeyToAddress(request.signer.publicKey);
  const encodePermissions = Schema.encodeSync(EvmSessionPermissions);
  const bindings = registration.installations.map((installation) => {
    const expected = requested.get(installation.chainId);
    if (!expected || !requested.delete(installation.chainId))
      throw new LocalSessionRegistrationError({ code: "NETWORK_MISMATCH" });
    const expectedPermissions = JSON.stringify(encodePermissions(expected.permissions));

    const authorization = installation.authorization;
    if (!isAddressEqual(authorization.signerAddress, signerAddress))
      throw new LocalSessionRegistrationError({ code: "IDENTITY_MISMATCH" });
    if (
      authorization.validAfter !== expected.validAfter ||
      authorization.validUntil !== expected.validUntil ||
      (authorization.allowSignatures === true) !== (expected.allowSignatures === true) ||
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
      isGlobal: expected.permissions.some((permission) => permission.type === "root"),
      // Alchemy v2 attaches execution hooks only for native/ERC-20 spend permissions.
      // Gas, time and target/selector restrictions are validation hooks.
      hasExecutionHooks: expected.permissions.some(
        (permission) =>
          permission.type === "native-token-transfer" || permission.type === "erc20-token-transfer",
      ),
      allowSignatures: expected.allowSignatures === true,
      validAfter: DateTime.formatIso(DateTime.makeUnsafe(expected.validAfter * 1000)),
      validUntil: DateTime.formatIso(DateTime.makeUnsafe(expected.validUntil * 1000)),
    });
  });
  return bindings;
};
