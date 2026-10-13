import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { Effect } from "effect";

import { createOffchainClient } from "@thenamespace/offchain-manager";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { makeEnsService } from "../../src/service.js";

describe("Namespace lookup adapter", () => {
  const server = createServer((request, response) => {
    const label = request.url?.split("/").at(-1)?.split(".")[0];
    const status =
      label === "missing" ? 404 : label === "denied" ? 401 : label === "failure" ? 500 : 200;
    response.writeHead(status, { "content-type": "application/json" });
    response.end(
      JSON.stringify(
        status === 200 ? { fullName: "existing.namera.id" } : { message: "Lookup failed" },
      ),
    );
  });
  let ens: ReturnType<typeof makeEnsService>;

  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    ens = makeEnsService(
      createOffchainClient({ backendUri: `http://127.0.0.1:${port}`, timeout: 1000 }),
    );
  });
  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it("returns null for the real SDK's rejected 404 lookup", async () => {
    expect(await Effect.runPromise(ens.getSingleSubname("missing.namera.id"))).toBeNull();
  });

  it("preserves successful lookups", async () => {
    expect(await Effect.runPromise(ens.getSingleSubname("existing.namera.id"))).toEqual({
      fullName: "existing.namera.id",
    });
  });

  it.each(["denied", "failure"])("does not treat %s responses as missing names", async (label) => {
    const error = await Effect.runPromise(Effect.flip(ens.getSingleSubname(`${label}.namera.id`)));
    expect(error).toMatchObject({
      _tag: "EnsError",
      operation: "getSingleSubname",
      reason: "REQUEST_FAILED",
    });
  });
});
