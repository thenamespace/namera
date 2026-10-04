import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import { enforceActor } from "#/helpers/index";

const authorizeRead = Effect.gen(function* () {
  const actor = yield* CurrentActor;
  return yield* enforceActor({
    actor,
    allowedActors: ["user", "api-key", "cli"],
    requiredPermissions: { user: ["wallet:read"], "api-key": [], cli: ["wallet:read"] },
  });
});

export const AddressMetadataRoutes = HttpApiBuilder.group(
  NameraApi,
  "addressMetadata",
  (handlers) =>
    Effect.gen(function* () {
      const app = yield* Application.Application;
      return handlers
        .handle("resolve", ({ payload }) =>
          Effect.gen(function* () {
            yield* authorizeRead;
            return { items: yield* app.data.addressMetadata.resolve(payload) };
          }),
        )
        .handle("search", ({ query }) =>
          Effect.gen(function* () {
            yield* authorizeRead;
            return {
              items: yield* app.data.addressMetadata.search(query),
              nextCursor: null,
            };
          }),
        )
        .handle("get", ({ params }) =>
          Effect.gen(function* () {
            yield* authorizeRead;
            return yield* app.data.addressMetadata.get(params);
          }),
        );
    }),
);

export const PortfolioRoutes = HttpApiBuilder.group(NameraApi, "portfolio", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;
    return handlers.handle("query", ({ payload }) =>
      Effect.gen(function* () {
        yield* authorizeRead;
        return yield* app.data.portfolio.query(payload);
      }),
    );
  }),
);
