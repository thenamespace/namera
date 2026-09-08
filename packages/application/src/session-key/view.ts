import { Effect } from "effect";

import { Repository, type WalletView } from "@namera-ai/database";
import type { OrganizationId } from "@namera-ai/protocol";
import type {
  EvmSessionKey,
  OrganizationMember,
  OrganizationRole,
  User,
  SessionKeyInstallation,
} from "@namera-ai/protocol/model";

export interface SessionKeyView {
  readonly sessionKey: EvmSessionKey;
  readonly installations: ReadonlyArray<SessionKeyInstallation>;
  readonly wallet: WalletView;
  readonly creator: {
    readonly organizationMember: OrganizationMember;
    readonly organizationRole: OrganizationRole;
    readonly user: User;
  };
}

export const makeLoadSessionKeyViews = Effect.gen(function* () {
  const repository = yield* Repository;

  return Effect.fnUntraced(function* (
    organizationId: OrganizationId,
    sessionKeys: ReadonlyArray<EvmSessionKey>,
  ) {
    if (sessionKeys.length === 0) return [];

    const [wallets, creators, installations] = yield* Effect.all([
      repository.core.wallet.findForOrganization(organizationId),
      repository.auth.member.findByActorIds(organizationId, [
        ...new Set(sessionKeys.map((sessionKey) => sessionKey.createdByActorId)),
      ]),
      repository.core.sessionKeyInstallation.findForSessions(
        organizationId,
        sessionKeys.map(({ id }) => id),
      ),
    ]);
    const walletById = new Map(wallets.map((wallet) => [wallet.wallet.id, wallet]));
    const creatorByActorId = new Map(
      creators.map((creator) => [creator.organizationMember.actorId, creator]),
    );

    const views: Array<SessionKeyView> = [];
    for (const sessionKey of sessionKeys) {
      const wallet = walletById.get(sessionKey.walletId);
      const creator = creatorByActorId.get(sessionKey.createdByActorId);
      if (wallet === undefined || creator === undefined) {
        return yield* Effect.die("Session-key response relation is missing");
      }
      views.push({
        sessionKey,
        wallet,
        creator,
        installations: installations.filter(
          (installation) => installation.sessionKeyId === sessionKey.id,
        ),
      });
    }
    return views;
  });
});
