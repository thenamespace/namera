import { describe, expect, it } from "@effect/vitest";
import { Effect, Option, Schema } from "effect";

import { ExecuteRequest } from "@namera-ai/protocol/dto";

import { resolveParams } from "../../../src/commands/common.js";

const executeParams = JSON.stringify({
  namespace: "eip155",
  walletId: "01a01924-9b93-754b-a6a2-cbdb597757cf",
  sessionKeyId: "01a01924-9b93-754b-a6a2-cbdb597757d0",
  chainId: "eip155:11155111",
  sponsor: false,
  calls: [
    {
      to: "0x0000000000000000000000000000000000000001",
      value: "100000000000000",
      data: "0x",
    },
  ],
});

describe("CLI input and output", () => {
  it.effect("decodes inline params without evaluating the interactive fallback", () =>
    Effect.gen(function* () {
      const request = yield* resolveParams(
        Option.some(executeParams),
        ExecuteRequest,
        Effect.die("interactive prompt must not run"),
      );

      expect(request.calls[0]?.value).toBe(100000000000000n);
      expect(request.sponsor).toBe(false);
    }),
  );

  it.effect("rejects malformed inline params without opening a prompt", () =>
    Effect.gen(function* () {
      const error = yield* resolveParams(
        Option.some('{"namespace":"eip155"}'),
        ExecuteRequest,
        Effect.die("interactive prompt must not run"),
      ).pipe(Effect.flip);
      expect(Schema.isSchemaError(error)).toBe(true);
    }),
  );

  it.effect("uses the prompt result only when inline params are absent", () =>
    Effect.gen(function* () {
      const expected = Schema.decodeUnknownSync(Schema.fromJsonString(ExecuteRequest))(
        executeParams,
      );
      const result = yield* resolveParams(Option.none(), ExecuteRequest, Effect.succeed(expected));
      expect(result).toEqual(expected);
    }),
  );
});
