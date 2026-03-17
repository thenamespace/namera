import { Effect, Option, Schema } from "effect";
import { Prompt } from "effect/unstable/cli";

import { EthereumAddress } from "@/schema";

export const addressPrompt = (message: string) =>
  Prompt.text({
    message,
    validate: (value) =>
      Effect.gen(function* () {
        const res = Schema.decodeUnknownOption(EthereumAddress)(value);
        if (Option.isNone(res))
          return yield* Effect.fail("Invalid Ethereum Address");
        return value;
      }),
  });

export const etherPrompt = (message: string) =>
  Prompt.text({
    message,
    validate: (val) =>
      Effect.gen(function* () {
        const schema = Schema.NumberFromString.check(
          Schema.isGreaterThanOrEqualTo(0),
        );
        const res = Schema.decodeOption(schema)(val);
        if (Option.isNone(res)) return yield* Effect.fail("Invalid Number");
        return res.value.toString();
      }),
  });
