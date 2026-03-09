import { FetchHttpClient, HttpApiClient } from "@effect/platform";
import { api } from "@repo/api";
import { Email } from "@repo/schema";
import { Effect } from "effect";

const program = Effect.gen(function* () {
  const client = yield* HttpApiClient.make(api, {
    baseUrl: "http://localhost:8080",
  });

  const callbackUrl = new URL("http://localhost:3000/callback");

  const res = yield* client.auth.signInMagicLink({
    payload: {
      callbackUrl,
      email: Email.make("vedant@test.com"),
      errorCallbackUrl: callbackUrl,
      name: "Vedant",
      newUserCallbackUrl: callbackUrl,
    },
  });

  yield* Effect.log("Response: ", res);
}).pipe(Effect.catchAll((e) => Effect.log("Error: ", e)));

Effect.runFork(program.pipe(Effect.provide(FetchHttpClient.layer)));
