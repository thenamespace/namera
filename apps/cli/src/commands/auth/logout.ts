import { Effect } from "effect";
import { Command } from "effect/cli";

import { profileFlag } from "#/commands/common";
import { removeProfile } from "#/services/config";
import { deleteCredentials } from "#/services/credentials";
import { printValue } from "#/services/output";
import { logoutView } from "#/services/output/auth";

export const logoutCommand = Command.make(
  "logout",
  { profile: profileFlag },
  Effect.fn(function* ({ profile }) {
    yield* Effect.sync(() => deleteCredentials(profile));
    yield* Effect.tryPromise(() => removeProfile(profile));
    yield* printValue({ profile, status: "signed-out" }, logoutView);
  }),
).pipe(Command.withDescription("Sign out of a saved connection on this device"));
