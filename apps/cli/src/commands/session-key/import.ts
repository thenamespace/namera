import { Effect, Option, Schema } from "effect";
import { Argument, Command, Flag, Prompt } from "effect/cli";

import { EncryptedLocalSessionKey } from "@namera-ai/protocol/local";

import { profileFlag } from "#/commands/common";
import { printValue } from "#/services/output";
import { recordView } from "#/services/output/document";
import { sessionKeyImportOrigin } from "#/services/session-keystore/import-origin";
import { sessionKeystore } from "#/services/session-keystore/index";
import { SessionKeystoreError } from "#/services/session-keystore/storage";

export const importSessionKeyCommand = Command.make(
  "import",
  {
    encryptedExport: Argument.String("encrypted-export"),
    profile: profileFlag,
    host: Flag.String("host").pipe(
      Flag.optional,
      Flag.withDescription("API host for this key; importing does not require login"),
    ),
  },
  Effect.fn("cli.sessionKey.import")(function* ({ encryptedExport, profile, host }) {
    const envelope = yield* Effect.try({
      try: () => {
        if (encryptedExport.length > 128 * 1024 || !/^[A-Za-z0-9_-]+$/.test(encryptedExport))
          throw new Error("Invalid export");
        return Schema.decodeUnknownSync(Schema.fromJsonString(EncryptedLocalSessionKey))(
          Buffer.from(encryptedExport, "base64url").toString("utf8"),
        );
      },
      catch: () => new SessionKeystoreError({ code: "IMPORT_FAILED" }),
    });
    const apiOrigin = yield* Effect.tryPromise(() =>
      sessionKeyImportOrigin(profile, Option.getOrUndefined(host)),
    );
    const password = yield* Prompt.Password({ message: "Export passphrase" });
    const result = yield* Effect.tryPromise({
      try: () => sessionKeystore.importKey(envelope, password, apiOrigin),
      catch: () => new SessionKeystoreError({ code: "IMPORT_FAILED" }),
    });
    yield* printValue({ status: "imported", ...result }, recordView("Session key imported"));
  }),
).pipe(
  Command.withDescription(
    "Import an encrypted dashboard session export; passphrase is entered securely",
  ),
);
