import { Config, Effect, Schema } from "effect";

import { bootstrapPlatformOwner } from "@namera-ai/application";
import { DatabaseMigration } from "@namera-ai/database";
import { Email } from "@namera-ai/protocol";

export const bootstrapConfiguredAdminOwner = Effect.fn("server.admin.bootstrapOwner")(function* () {
  yield* DatabaseMigration;
  const configuredEmail = yield* Config.String("ADMIN_BOOTSTRAP_OWNER_EMAIL").pipe(
    Config.withDefault(""),
  );
  if (configuredEmail.trim() === "") return;

  const email = yield* Schema.decodeUnknownEffect(Email)(configuredEmail);
  yield* bootstrapPlatformOwner(email).pipe(
    Effect.tap(() => Effect.logInfo("admin.owner_bootstrapped")),
    Effect.catchTag("PlatformAuthError", (error) => {
      if (error.code === "OWNER_ALREADY_EXISTS") return Effect.void;
      if (error.code === "VERIFIED_USER_REQUIRED")
        return Effect.logWarning("admin.owner_bootstrap_skipped").pipe(
          Effect.annotateLogs({ reason: "verified_user_required" }),
        );
      return Effect.fail(error);
    }),
  );
});
