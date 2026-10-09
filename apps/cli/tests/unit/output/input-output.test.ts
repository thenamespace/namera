import { Effect, Option } from "effect";

import { ExecuteRequest } from "@namera-ai/protocol/dto";
import { describe, expect, it } from "vitest";

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
  it("decodes inline params without evaluating the interactive fallback", async () => {
    const request = await Effect.runPromise(
      resolveParams(
        Option.some(executeParams),
        ExecuteRequest,
        Effect.die("interactive prompt must not run"),
      ),
    );

    expect(request.calls[0]?.value).toBe(100000000000000n);
    expect(request.sponsor).toBe(false);
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
});
