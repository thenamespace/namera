import { readFile } from "node:fs/promises";

import { Effect, Schema } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { VerifySignatureRequest } from "@namera-ai/protocol/dto";

import { jsonFlag, profileFlag } from "#/commands/common";
import { makeCliClient } from "#/services/client";
import { printValue, runPromise } from "#/services/output";

export const verifySignatureCommand = Command.make(
  "verify-signature",
  {
    file: Flag.string("file").pipe(
      Flag.withDescription("JSON message or typed-data verification request file"),
    ),
    profile: profileFlag,
    json: jsonFlag,
  },
  Effect.fn(function* ({ file, profile, json }) {
    const raw = yield* Effect.tryPromise(() => readFile(file, "utf8"));
    const request = yield* Schema.decodeUnknownEffect(VerifySignatureRequest)(JSON.parse(raw));
    const { client } = yield* Effect.tryPromise(() => makeCliClient(profile));
    yield* printValue(yield* runPromise(client.verifySignature(request)), json);
  }),
).pipe(Command.withDescription("Verify an EVM smart-account signature"));
