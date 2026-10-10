import { Effect } from "effect";

import { getChainDataByCaip2 } from "@namera-ai/evm/chains";
import type {
  GetWalletPasskeyOwnerResponse,
  SessionKeyResponse,
  WalletResponse,
} from "@namera-ai/protocol/dto";
import type { ReviewedOwnerOperation } from "@namera-ai/sdk";
import { createPublicClient, http } from "viem";

import { isOneClawAccount } from "@/lib/session-owner";

export async function reviewSessionInstallation(
  wallet: WalletResponse,
  installation: SessionKeyResponse["installations"][number],
  descriptor: GetWalletPasskeyOwnerResponse,
  kind: "install" | "uninstall",
  signal: AbortSignal,
  apiOrigin: string,
): Promise<ReviewedOwnerOperation> {
  const { owner } = descriptor;
  if (
    !owner ||
    wallet.owner.custody !== "local" ||
    descriptor.walletId !== wallet.id ||
    owner.signingKeyId !== wallet.owner.signingKeyId ||
    wallet.data.validatorType !== "webauthn_p256"
  ) {
    throw new Error("Passkey owner does not match this account");
  }
  const { reviewEvmSessionOperation } = await import("@namera-ai/evm/session-review");
  const chain = getChainDataByCaip2(installation.chainId);
  if (!chain) throw new Error("Unsupported approval chain");
  const reviewed = await Effect.runPromise(
    reviewEvmSessionOperation(
      {
        wallet: { ...wallet.data, address: wallet.address, implementation: wallet.implementation },
        ownerPublicKey: owner.publicKeyHex,
        chainId: installation.chainId,
        authorization: installation.authorization,
        kind,
      },
      createPublicClient({
        chain: chain.chain,
        transport: http(`${apiOrigin}/rpc/eip155/${chain.chain.id}`),
      }),
    ),
    { signal },
  );
  return { ...reviewed, credentialId: owner.credentialId, rpId: owner.rpId, sponsor: true };
}

export async function reviewManagedSessionInstallation(
  wallet: WalletResponse,
  installation: SessionKeyResponse["installations"][number],
  kind: "install" | "uninstall",
  signal: AbortSignal,
  apiOrigin: string,
) {
  if (
    !isOneClawAccount(wallet) ||
    wallet.status !== "active" ||
    wallet.data.validatorType !== "ecdsa_secp256k1" ||
    wallet.data.accountMode !== "factory"
  ) {
    throw new Error("Managed owner does not match this account");
  }
  const { reviewManagedEvmSessionOperation } = await import("@namera-ai/evm/session-review");
  const chain = getChainDataByCaip2(installation.chainId);
  if (!chain) throw new Error("Unsupported approval chain");
  const reviewed = await Effect.runPromise(
    reviewManagedEvmSessionOperation(
      {
        wallet: { ...wallet.data, address: wallet.address, implementation: wallet.implementation },
        chainId: installation.chainId,
        authorization: installation.authorization,
        kind,
      },
      createPublicClient({
        chain: chain.chain,
        transport: http(`${apiOrigin}/rpc/eip155/${chain.chain.id}`),
      }),
    ),
    { signal },
  );
  return { ...reviewed, sponsor: true };
}
