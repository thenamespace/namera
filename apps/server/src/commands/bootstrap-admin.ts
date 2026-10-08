import { NodeRuntime } from "@effect/platform-node";
import { Console, Effect, Layer, Schema } from "effect";

import { bootstrapPlatformOwner } from "@namera-ai/application";
import { Database, Repository, TransactionService } from "@namera-ai/database";
import { Email, PlatformAuthError } from "@namera-ai/protocol";

const persistence = Layer.mergeAll(Repository.layer, TransactionService.layer).pipe(
  Layer.provide(Database.layer),
);

Effect.gen(function* () {
  const email = yield* Schema.decodeUnknownEffect(Email)(process.argv[2]);
  yield* bootstrapPlatformOwner(email);
  yield* Console.log("Admin owner created. Sign in with your existing Google or email login.");
}).pipe(
  Effect.provide(persistence),
  Effect.catch((error) =>
    Effect.gen(function* () {
      yield* Console.error(
        error instanceof PlatformAuthError
          ? `Could not create admin owner: ${error.code}.`
          : "Could not create admin owner. Check the email argument, database configuration, and applied migrations.",
      );
      process.exitCode = 1;
    }),
  ),
  NodeRuntime.runMain,
);
