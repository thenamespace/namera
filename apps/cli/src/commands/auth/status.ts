import { Effect } from "effect";
import { Command } from "effect/unstable/cli";

import { profileFlag } from "#/commands/common";
import { makeCliClient } from "#/services/client";
import { printValue, runPromise } from "#/services/output";

export const authStatusCommand = Command.make(
  "status",
  { profile: profileFlag },
  Effect.fn(function* ({ profile }) {
    const { client, profileName } = yield* Effect.tryPromise(() => makeCliClient(profile));
    const actor = yield* runPromise(client.auth.currentActor());
    yield* printValue({ profile: profileName, actor });
  }),
).pipe(Command.withDescription("Show the current delegated CLI actor"));
