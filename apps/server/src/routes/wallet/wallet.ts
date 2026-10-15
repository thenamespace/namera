import { Effect } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/http-api";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";
import { WalletCustodyUnavailableError } from "@namera-ai/protocol";

import {
  enforceActor,
  enforceManagementActor,
  requireDashboardOrigin,
  toActorReadScope,
  toWalletResponse,
} from "#/helpers/index";
import { consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

export const WalletRoutes = HttpApiBuilder.group(NameraApi, "wallet", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;
    const config = yield* Application.AuthConfig;
    return handlers
      .handle("createPasskeyRegistrationOptions", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceManagementActor(actor, "wallet:create");
          if (actor.type === "user")
            yield* requireDashboardOrigin(config.dashboardPublicOrigin.origin);
          if (actor.type === "api-key") {
            if (!payload?.origin || !payload.user) return yield* new HttpApiError.Forbidden();
            return yield* app.wallet.createPasskeyRegistrationOptions({
              ...data,
              origin: payload.origin,
              userName: payload.user.name,
              userDisplayName: payload.user.displayName,
            });
          }
          if (actor.type !== "user") return yield* new HttpApiError.Forbidden();
          return yield* app.wallet.createPasskeyRegistrationOptions({
            ...data,
            userId: actor.data.user.id,
            userName: actor.data.user.email,
            userDisplayName: actor.data.user.metadata.name ?? actor.data.user.email,
          });
        }),
      )
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceManagementActor(actor, "wallet:create");
          if (actor.type === "user")
            yield* requireDashboardOrigin(config.dashboardPublicOrigin.origin);
          // Only the 1Claw managed provider is admitted by the public API.
          if (payload.owner.type !== "passkey" && payload.owner.provider !== "1claw")
            return yield* new WalletCustodyUnavailableError({ code: "MANAGED_WALLETS_DISABLED" });
          if (payload.owner.type === "namera-managed")
            yield* consumeRateLimit(
              "wallet.managed.create.organization",
              data.organizationId,
              rateLimitPolicy.managedWallet.createByOrganization,
            );
          return toWalletResponse(
            yield* app.wallet.create({
              organizationId: data.organizationId,
              actorId: data.actorId,
              ...(actor.type === "user" ? { userId: actor.data.user.id } : {}),
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
          return (yield* app.wallet.list(toActorReadScope(data, "wallet:read"))).map(
            toWalletResponse,
          );
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
            yield* app.wallet.get({
              ...toActorReadScope(data, "wallet:read"),
              walletId: params.walletId,
            }),
          );
        }),
      )
      .handle("getPasskeyOwner", ({ params }) =>
        Effect.gen(function* () {
          const data = yield* enforceManagementActor(yield* CurrentActor, "wallet:read");
          const { wallet, signingKey } = yield* app.wallet.get({
            organizationId: data.organizationId,
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
                    origin: signingKey.data.origin ?? config.dashboardPublicOrigin.origin,
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
            ...toActorReadScope(data, "wallet:read"),
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
          yield* requireDashboardOrigin(config.dashboardPublicOrigin.origin);
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
