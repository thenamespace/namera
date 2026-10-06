import { Effect } from "effect";
import { Command } from "effect/cli";

import { profileFlag } from "#/commands/common";
import { nameraCommand } from "#/commands/root";
import { makeCliClient } from "#/services/client";
import { printValue, runPromise } from "#/services/output";
import { authView } from "#/services/output/auth";

export const authStatusCommand = Command.make(
  "status",
  { profile: profileFlag },
  Effect.fn(function* ({ profile }) {
    const {
      client,
      profileName,
      profile: savedProfile,
    } = yield* Effect.tryPromise(() => makeCliClient(profile));
    const actor = yield* runPromise(client.auth.currentActor());
    const { output, quiet } = yield* nameraCommand;
    const canReadWallets =
      !("authorization" in actor.data) || actor.data.authorization.scopes.includes("wallet:read");
    const wallets =
      output === "pretty" && !quiet && canReadWallets
        ? yield* runPromise(client.wallets.list())
        : [];
    yield* printValue({ profile: profileName, actor }, (value, colors) =>
      authView(
        {
          ...value,
          wallets,
          ...(savedProfile.organizationName
            ? { organizationName: savedProfile.organizationName }
            : {}),
        },
        colors,
      ),
    );
  }),
).pipe(Command.withDescription("Show your connection and permissions"));
