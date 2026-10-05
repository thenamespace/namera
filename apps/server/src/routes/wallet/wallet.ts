import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";
import { WalletCustodyUnavailableError } from "@namera-ai/protocol";

import { enforceActor, toActorReadScope, toWalletResponse } from "#/helpers/index";

export const WalletRoutes = HttpApiBuilder.group(NameraApi, "wallet", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;
    return handlers
      .handle("createPasskeyRegistrationOptions", () =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["wallet:create"] },
          });
          return yield* app.wallet.createPasskeyRegistrationOptions({
            organizationId: data.organization.id,
            userId: data.user.id,
            userName: data.user.email,
            userDisplayName: data.user.metadata.name ?? data.user.email,
          });
        }),
      )
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["wallet:create"] },
          });
          // Managed providers remain available internally for future products,
          // but the beta never creates a server-controlled owner key.
          if (payload.owner.type !== "passkey")
            return yield* new WalletCustodyUnavailableError({ code: "MANAGED_WALLETS_DISABLED" });
          return toWalletResponse(
            yield* app.wallet.create({
              organizationId: data.organization.id,
              actorId: data.actorId,
              userId: data.user.id,
              request: payload,
            }),
          );
        }),
      )
      .handle("list", () =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user", "api-key", "cli", "mcp"],
            requiredPermissions: {
              user: ["wallet:read"],
              "api-key": [],
              cli: ["wallet:read"],
              mcp: ["mcp:read"],
            },
          });
          return (yield* app.wallet.list(toActorReadScope(data))).map(toWalletResponse);
        }),
      )
      .handle("get", ({ params }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user", "api-key", "cli", "mcp"],
            requiredPermissions: {
              user: ["wallet:read"],
              "api-key": [],
              cli: ["wallet:read"],
              mcp: ["mcp:read"],
            },
          });
          return toWalletResponse(
            yield* app.wallet.get({ ...toActorReadScope(data), walletId: params.walletId }),
          );
        }),
      )
      .handle("getPasskeyOwner", ({ params }) =>
        Effect.gen(function* () {
          const data = yield* enforceActor({
            actor: yield* CurrentActor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["wallet:read"] },
          });
          const { wallet, signingKey } = yield* app.wallet.get({
            organizationId: data.organization.id,
            walletId: params.walletId,
          });
          return {
            walletId: wallet.id,
            owner:
              signingKey.custody === "local" && signingKey.data.type === "passkey"
                ? {
                    signingKeyId: signingKey.id,
                    publicKeyHex: signingKey.publicKeyHex,
                    credentialId: signingKey.data.credentialId,
                    rpId: signingKey.data.rpId,
                  }
                : null,
          };
        }),
      )
      .handle("getPortfolio", ({ params, query }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user", "api-key", "cli", "mcp"],
            requiredPermissions: {
              user: ["wallet:read"],
              "api-key": [],
              cli: ["wallet:read"],
              mcp: ["mcp:read"],
            },
          });
          return yield* app.wallet.getPortfolio({
            ...toActorReadScope(data),
            walletId: params.walletId,
            request: query,
          });
        }),
      )
      .handle("update", ({ params, payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["wallet:update"] },
          });
          return toWalletResponse(
            yield* app.wallet.update({
              organizationId: data.organization.id,
              actorId: data.actorId,
              walletId: params.walletId,
              request: payload,
            }),
          );
        }),
      );
  }),
);
