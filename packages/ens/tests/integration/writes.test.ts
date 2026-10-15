import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { Effect } from "effect";

import { ChainName, createOffchainClient } from "@thenamespace/offchain-manager";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";

import { makeEnsService } from "../../src/service.js";

const requests: Array<{ path: string; method: string; token: string | undefined; body: unknown }> =
  [];
let rejectWrites = false;
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = Buffer.concat(chunks).toString();
  requests.push({
    path: request.url ?? "",
    method: request.method ?? "",
    token: request.headers["x-auth-token"] as string | undefined,
    body: body ? JSON.parse(body) : null,
  });
  response.writeHead(rejectWrites && request.method === "POST" ? 403 : 200, {
    "content-type": "application/json",
  });
  response.end(
    JSON.stringify({
      label: "example",
      parentName: "namera.id",
      addresses: {},
      texts: { description: "Keep me" },
      metadata: {},
    }),
  );
});
let ens: ReturnType<typeof makeEnsService>;
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    ens = makeEnsService(
      createOffchainClient({
        backendUri: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        timeout: 1000,
        defaultApiKey: "synthetic-test-key",
      }),
    );
  } catch (error) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw error;
  }
});
beforeEach(() => {
  requests.length = 0;
  rejectWrites = false;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

it("sends the authenticated create request without losing ownership", async () => {
  const owner = "0x1111111111111111111111111111111111111111";
  await Effect.runPromise(ens.createSubname({ label: "example", parentName: "namera.id", owner }));
  expect(requests).toEqual([
    {
      path: "/api/v1/subnames",
      method: "POST",
      token: "synthetic-test-key",
      body: { label: "example", parentName: "namera.id", owner, addresses: [] },
    },
  ]);
});

it("preserves existing text records while adding an avatar", async () => {
  await Effect.runPromise(
    ens.addTextRecord("example.namera.id", "avatar", "https://example.test/avatar.webp"),
  );
  expect(requests.at(-1)).toMatchObject({
    path: "/api/v1/subnames",
    method: "POST",
    token: "synthetic-test-key",
    body: {
      texts: [
        { key: "description", value: "Keep me" },
        { key: "avatar", value: "https://example.test/avatar.webp" },
      ],
    },
  });
});

it("does not translate a rejected write into successful absence", async () => {
  rejectWrites = true;
  expect(
    await Effect.runPromise(
      ens
        .addTextRecord("example.namera.id", "avatar", "https://example.test/avatar.webp")
        .pipe(Effect.flip),
    ),
  ).toMatchObject({ _tag: "EnsError", operation: "addTextRecord", reason: "REQUEST_FAILED" });
  expect(requests.filter((request) => request.method === "POST")).toHaveLength(1);
});

it("encodes Ethereum address records with the correct coin type", async () => {
  const address = "0x1111111111111111111111111111111111111111";
  await Effect.runPromise(ens.addAddressRecord("example.namera.id", ChainName.Ethereum, address));
  expect(requests.at(-1)).toMatchObject({
    token: "synthetic-test-key",
    body: {
      addresses: [{ coin: 60, value: address }],
      texts: [{ key: "description", value: "Keep me" }],
    },
  });
});

it("preserves JSON data records through the SDK request", async () => {
  const value = { theme: "dark", links: ["https://example.test"] };
  await Effect.runPromise(ens.addDataRecord("example.namera.id", "profile", value));
  expect(requests.at(-1)).toMatchObject({
    token: "synthetic-test-key",
    body: {
      metadata: [{ key: "profile", value }],
      texts: [{ key: "description", value: "Keep me" }],
    },
  });
});

it("forwards the owner filter without widening the lookup", async () => {
  const query = {
    parentName: "namera.id",
    owner: "0x1111111111111111111111111111111111111111",
    page: 2,
    size: 10,
  };
  await Effect.runPromise(ens.getFilteredSubnames(query));
  expect(requests).toEqual([
    { path: "/api/v1/subnames/search", method: "POST", token: undefined, body: query },
  ]);
});
