import { Config, DateTime, Effect } from "effect";

import { Repository } from "@namera-ai/database";
import {
  WalletTransactionError,
  type ActorId,
  type OrganizationId,
  type WalletId,
} from "@namera-ai/protocol";
import type { WalletOperation } from "@namera-ai/protocol/model";

import { makeLoadPublicSessionOwner } from "#/wallet/public-owner";

export type WalletTransactionScope = {
  readonly organizationId: OrganizationId;
  readonly actorId: ActorId;
  readonly walletId: WalletId;
};

export const makeTransactionOwner = Effect.gen(function* () {
  const repository = yield* Repository;
  const publicOwner = yield* makeLoadPublicSessionOwner;
  const load = Effect.fnUntraced(function* (scope: WalletTransactionScope) {
    const wallet = yield* repository.core.wallet.findById(scope.walletId, scope.organizationId);
    if (!wallet) return yield* new WalletTransactionError({ code: "OWNER_UNAVAILABLE" });
    const [member] = yield* repository.auth.member.findByActorIds(scope.organizationId, [
      scope.actorId,
    ]);
    if (
      !member ||
      member.organizationMember.removedAt !== null ||
      member.organizationRole.type !== "system" ||
      member.organizationRole.key !== "owner" ||
      !member.organizationRole.permissions.includes("wallet:update")
    )
      return yield* new WalletTransactionError({ code: "OWNER_UNAVAILABLE" });
    const owner = yield* publicOwner(wallet).pipe(
      Effect.mapError(() => new WalletTransactionError({ code: "OWNER_UNAVAILABLE" })),
    );
    if (owner.type === "1claw") {
      const appId = yield* Config.String("ONECLAW_PLATFORM_APP_ID").pipe(Effect.orDie);
      const connection = yield* repository.core.providerConnections.findByOrganization(
        scope.organizationId,
        appId,
      );
      if (
        !connection ||
        connection.id !== wallet.signingKey.providerConnectionId ||
        connection.status !== "ready"
      )
        return yield* new WalletTransactionError({ code: "OWNER_UNAVAILABLE" });
    }
    return { ...owner, wallet };
  });
  const check = Effect.fnUntraced(function* (operation: WalletOperation) {
    const owner = yield* load(operation);
    if (
      operation.data.owner.signingKeyId !== owner.wallet.signingKey.id ||
      operation.data.owner.publicKey !== owner.wallet.signingKey.publicKeyHex
    )
      return yield* new WalletTransactionError({ code: "OWNER_UNAVAILABLE" });
    if (DateTime.toEpochMillis(operation.expiresAt) <= DateTime.toEpochMillis(yield* DateTime.now))
      return yield* new WalletTransactionError({ code: "APPROVAL_EXPIRED" });
    return owner;
  });
  return { load, check };
});
