import { Effect } from "effect";

import { Repository } from "@namera-ai/database";
import { createPublicKeyWebAuthnAccount } from "@namera-ai/evm";
import {
  SessionKeyOperationError,
  type OrganizationId,
  type SessionKeyInstallationId,
} from "@namera-ai/protocol";

import { AuthConfig } from "#/auth/config";

/** Resolve stored authority; callers never choose the owner or operation calldata. */
export const makeLoadSessionOperationOwner = Effect.gen(function* () {
  const repository = yield* Repository;
  const config = yield* AuthConfig;
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
    if (
      wallet.wallet.status !== "active" ||
      wallet.wallet.data.validatorType !== "webauthn_p256" ||
      wallet.signingKey.custody !== "local" ||
      wallet.signingKey.status !== "active" ||
      wallet.signingKey.data.type !== "passkey" ||
      wallet.signingKey.data.rpId !== config.dashboardPublicOrigin.hostname
    ) {
      return yield* new SessionKeyOperationError({ code: "OWNER_UNAVAILABLE" });
    }
    return {
      installation,
      session,
      wallet,
      credential: wallet.signingKey.data,
      account: {
        wallet: wallet.wallet.data,
        owner: {
          validatorType: "webauthn_p256" as const,
          account: createPublicKeyWebAuthnAccount(wallet.signingKey.publicKeyHex),
        },
      },
    };
  });
});
