import { readFile } from "node:fs/promises";

import { Effect, Schema } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { SignRequest } from "@namera-ai/protocol/dto";

import { jsonFlag, profileFlag } from "#/commands/common";
import { makeCliClient } from "#/services/client";
import { printValue, runPromise } from "#/services/output";

export const signCommand = Command.make(
  "sign",
  {
    file: Flag.string("file").pipe(Flag.withDescription("JSON message or typed-data request file")),
    idempotencyKey: Flag.string("idempotency-key").pipe(
      Flag.withDescription("Stable key used to make one logical signing request"),
    ),
    profile: profileFlag,
    json: jsonFlag,
  },
  Effect.fn(function* ({ file, idempotencyKey, profile, json }) {
    const raw = yield* Effect.tryPromise(() => readFile(file, "utf8"));
    const request = yield* Schema.decodeUnknownEffect(SignRequest)(JSON.parse(raw));
    const { client } = yield* Effect.tryPromise(() => makeCliClient(profile));
    yield* printValue(yield* runPromise(client.sign(request, { idempotencyKey })), json);
  }),
).pipe(Command.withDescription("Sign an EVM message or typed-data request"));
