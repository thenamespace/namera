import { Config, Effect, Schema } from "effect";

import { Repository } from "@namera-ai/database";
import {
  WalletSignatureError,
  type ActorId,
  type OrganizationId,
  type WalletId,
} from "@namera-ai/protocol";
import { Wallet, type WalletSignatureOperation } from "@namera-ai/protocol/model";

import { makeLoadPublicSessionOwner } from "#/wallet/public-owner";

export type WalletSignatureScope = {
  readonly organizationId: OrganizationId;
  readonly actorId: ActorId;
  readonly walletId: WalletId;
};
export const makeWalletSignatureOwner = Effect.gen(function* () {
  const repository = yield* Repository;
  const publicOwner = yield* makeLoadPublicSessionOwner;
  const load = Effect.fnUntraced(function* (scope: WalletSignatureScope) {
    const [member] = yield* repository.auth.member.findByActorIds(scope.organizationId, [
      scope.actorId,
    ]);
    if (
      !member ||
      member.organizationMember.removedAt !== null ||
      member.organizationRole.type !== "system" ||
      member.organizationRole.key !== "owner"
    )
      return yield* new WalletSignatureError({ code: "OWNER_UNAVAILABLE" });
    const view = yield* repository.core.wallet.findById(scope.walletId, scope.organizationId);
    if (!view) return yield* new WalletSignatureError({ code: "OWNER_UNAVAILABLE" });
    const owner = yield* publicOwner(view).pipe(
      Effect.mapError(() => new WalletSignatureError({ code: "OWNER_UNAVAILABLE" })),
    );
    if (owner.type === "1claw") {
      const appId = yield* Config.String("ONECLAW_PLATFORM_APP_ID").pipe(Effect.orDie);
      const connection = yield* repository.core.providerConnections.findByOrganization(
        scope.organizationId,
        appId,
      );
      if (
        !connection ||
        connection.id !== view.signingKey.providerConnectionId ||
        connection.status !== "ready"
      )
        return yield* new WalletSignatureError({ code: "OWNER_UNAVAILABLE" });
    }
    const key = view.signingKey;
    // Counters advance after approval; all identity and account derivation fields remain pinned.
    const keyData = key.data.type === "passkey" ? { ...key.data, signCount: 0 } : key.data;
    const binding = JSON.stringify({
      keyId: key.id,
      publicKey: key.publicKeyHex,
      credentialId: key.credentialId,
      providerConnectionId: key.providerConnectionId,
      keyData,
      account: Schema.encodeSync(Wallet)(view.wallet).data,
    });
    return { ...owner, wallet: view, binding };
  });
  const check = Effect.fnUntraced(function* (operation: WalletSignatureOperation) {
    const owner = yield* load(operation);
    if (
      owner.binding !== operation.ownerBinding ||
      owner.wallet.signingKey.id !== operation.signingKeyId
    )
      return yield* new WalletSignatureError({ code: "OWNER_UNAVAILABLE" });
    return owner;
  });
  return { load, check };
});
