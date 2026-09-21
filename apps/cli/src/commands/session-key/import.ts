import { Effect, Schema } from "effect";
import { Argument, Command, Prompt } from "effect/unstable/cli";

import { EncryptedLocalSessionKey } from "@namera-ai/protocol/local";

import { profileFlag } from "#/commands/common";
import { makeCliClient } from "#/services/client";
import { printValue } from "#/services/output";
import { recordView } from "#/services/output/document";
import { sessionKeystore } from "#/services/session-keystore/index";
import { SessionKeystoreError } from "#/services/session-keystore/storage";

export const importSessionKeyCommand = Command.make(
  "import",
  {
    encryptedExport: Argument.String("encrypted-export"),
    profile: profileFlag,
  },
  Effect.fn("cli.sessionKey.import")(function* ({ encryptedExport, profile }) {
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
    const { profile: activeProfile } = yield* Effect.tryPromise(() => makeCliClient(profile));
    const password = yield* Prompt.Password({ message: "Export passphrase" });
    const result = yield* Effect.tryPromise({
      try: () =>
        sessionKeystore.importKey(envelope, password, new URL(activeProfile.baseUrl).origin),
      catch: () => new SessionKeystoreError({ code: "IMPORT_FAILED" }),
    });
    yield* printValue({ status: "imported", ...result }, recordView("Session key imported"));
  }),
).pipe(
  Command.withDescription(
    "Import an encrypted dashboard session export; passphrase is entered securely",
  ),
);
