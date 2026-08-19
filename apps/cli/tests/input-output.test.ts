import { Effect, Option } from "effect";

import { ExecuteRequest } from "@namera-ai/protocol/dto";
import { describe, expect, it } from "vitest";

import { resolveParams } from "../src/commands/common.js";
import { formatValue } from "../src/services/output.js";

const executeParams = JSON.stringify({
  namespace: "eip155",
  walletId: "01a01924-9b93-754b-a6a2-cbdb597757cf",
  chainId: "eip155:11155111",
  calls: [
    {
      to: "0x0000000000000000000000000000000000000001",
      value: "100000000000000",
      data: "0x",
    },
  ],
});

describe("CLI input and output", () => {
  it("decodes inline params without evaluating the interactive fallback", async () => {
    const request = await Effect.runPromise(
      resolveParams(
        Option.some(executeParams),
        ExecuteRequest,
        Effect.die("interactive prompt must not run"),
      ),
    );

    expect(request.calls[0]?.value).toBe(100000000000000n);
  });

  it("rejects malformed inline params through the command schema", async () => {
    await expect(
      Effect.runPromise(
        resolveParams(
          Option.some('{"namespace":"eip155"}'),
          ExecuteRequest,
          Effect.die("interactive prompt must not run"),
        ),
      ),
    ).rejects.toThrow("walletId");
  });

  it("formats stable pretty, JSON, and NDJSON output", () => {
    const value = [
      { id: "first", amount: 1n },
      { id: "second", amount: 2n },
    ];

    expect(formatValue(value, "pretty")).toEqual([
      '[\n  {\n    "id": "first",\n    "amount": "1"\n  },\n  {\n    "id": "second",\n    "amount": "2"\n  }\n]',
    ]);
    expect(formatValue(value, "json")).toEqual([
      '[{"id":"first","amount":"1"},{"id":"second","amount":"2"}]',
    ]);
    expect(formatValue(value, "ndjson")).toEqual([
      '{"id":"first","amount":"1"}',
      '{"id":"second","amount":"2"}',
    ]);
  });
});
