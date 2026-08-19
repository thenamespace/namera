import { Effect } from "effect";
import { Command } from "effect/unstable/cli";

import { profileFlag } from "#/commands/common";
import { removeProfile } from "#/services/config";
import { deleteCredentials } from "#/services/credentials";
import { printLine } from "#/services/output";

export const logoutCommand = Command.make(
  "logout",
  { profile: profileFlag },
  Effect.fn(function* ({ profile }) {
    yield* Effect.sync(() => deleteCredentials(profile));
    yield* Effect.tryPromise(() => removeProfile(profile));
    yield* printLine(`Logged out profile "${profile}".`);
  }),
).pipe(Command.withDescription("Remove a CLI profile and its stored credentials"));
