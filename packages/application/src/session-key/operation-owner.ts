import { Effect } from "effect";

import { Repository } from "@namera-ai/database";
import {
  SessionKeyOperationError,
  type OrganizationId,
  type SessionKeyInstallationId,
} from "@namera-ai/protocol";

import { makeLoadPublicSessionOwner } from "#/wallet/public-owner";

/** Resolve stored authority; callers never choose the owner or operation calldata. */
export const makeLoadSessionOperationOwner = Effect.gen(function* () {
  const repository = yield* Repository;
  const loadPublicOwner = yield* makeLoadPublicSessionOwner;
  return Effect.fn("application.sessionKey.loadOperationOwner")(function* (input: {
    readonly organizationId: OrganizationId;
    readonly installationId: SessionKeyInstallationId;
  }) {
    const installation = yield* repository.core.sessionKeyInstallation.findById({
      id: input.installationId,
      organizationId: input.organizationId,
    });
    if (installation === undefined)
      return yield* new SessionKeyOperationError({ code: "INSTALLATION_UNAVAILABLE" });
    const session = yield* repository.core.sessionKey.findById(
      installation.sessionKeyId,
      input.organizationId,
    );
    const wallet = yield* repository.core.wallet.findById(
      installation.walletId,
      input.organizationId,
    );
    if (
      session === undefined ||
      wallet === undefined ||
      session.walletId !== installation.walletId
    ) {
      return yield* new SessionKeyOperationError({ code: "INSTALLATION_UNAVAILABLE" });
    }
    const owner = yield* loadPublicOwner(wallet);
    return {
      installation,
      session,
      wallet,
      ...owner,
    };
  });
});
