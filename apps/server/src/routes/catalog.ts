import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { CurrentActor, CurrentAdmin, NameraApi } from "@namera-ai/api";
import { Application } from "@namera-ai/application";

import { enforceActor } from "#/helpers/index";
import { consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

const authorizeRead = Effect.gen(function* () {
  yield* enforceActor({
    actor: yield* CurrentActor,
    allowedActors: ["user", "api-key", "cli", "mcp"],
    requiredPermissions: {
      user: ["wallet:read"],
      "api-key": [],
      cli: ["wallet:read"],
      mcp: ["mcp:read"],
    },
  });
});

export const CatalogRoutes = HttpApiBuilder.group(NameraApi, "catalog", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application;
    return handlers
      .handle("search", ({ query }) =>
        authorizeRead.pipe(Effect.andThen(() => app.catalog.search(query))),
      )
      .handle("get", ({ params }) =>
        authorizeRead.pipe(Effect.andThen(() => app.catalog.get(params.catalogId))),
      )
      .handle("getEntry", ({ params }) =>
        authorizeRead.pipe(Effect.andThen(() => app.catalog.getEntry(params.entryId))),
      )
      .handle("resolve", ({ payload }) =>
        authorizeRead.pipe(Effect.andThen(() => app.catalog.resolve(payload.addresses))),
      )
      .handle("getInterface", ({ params }) =>
        authorizeRead.pipe(Effect.andThen(() => app.catalog.getInterface(params.interfaceId))),
      );
  }),
);

export const AdminCatalogRoutes = HttpApiBuilder.group(NameraApi, "adminCatalog", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application;
    return handlers
      .handle("list", ({ query }) =>
        Effect.gen(function* () {
          return yield* app.catalog.listAdmin(yield* CurrentAdmin, query);
        }),
      )
      .handle("import", ({ payload, query }) =>
        Effect.gen(function* () {
          const admin = yield* CurrentAdmin;
          yield* consumeRateLimit(
            "admin.catalog.import",
            admin.member.id,
            rateLimitPolicy.admin.writesGlobal,
          );
          return yield* app.catalog.import(admin, payload, query.dryRun);
        }),
      );
  }),
);
