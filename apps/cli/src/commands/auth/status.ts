import { Effect } from "effect";
import { Command } from "effect/unstable/cli";

import { jsonFlag, profileFlag } from "#/commands/common";
import { makeCliClient } from "#/services/client";
import { printValue, runPromise } from "#/services/output";

export const authStatusCommand = Command.make(
  "status",
  { profile: profileFlag, json: jsonFlag },
  Effect.fn(function* ({ profile, json }) {
    const { client, profileName } = yield* Effect.tryPromise(() => makeCliClient(profile));
    const actor = yield* runPromise(client.auth.currentActor());
    yield* printValue({ profile: profileName, actor }, json);
  }),
).pipe(Command.withDescription("Show the current delegated CLI actor"));
