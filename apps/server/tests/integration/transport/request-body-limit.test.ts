// oxlint-disable no-await-in-loop -- Each rejected body must be followed by a healthy request on the same listener.
import { request as httpRequest } from "node:http";

import { NodeHttpServer } from "@effect/platform-node";
import { Effect, Layer, ManagedRuntime, Predicate } from "effect";
import { HttpServer, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import { expect, it } from "vitest";

import { createHttpServer } from "../../../src/layers/http-server.js";
import { RequestBodyLimitMiddleware } from "../../../src/middlewares/request-body-limit.js";

const postChunked = (url: string, bytes: number) =>
  new Promise<number | "reset">((resolve, reject) => {
    const request = httpRequest(
      url,
      {
        method: "POST",
        headers: { "transfer-encoding": "chunked", "content-type": "application/json" },
        timeout: 5_000,
      },
      (response) => {
        response.resume();
        response.once("end", () => resolve(response.statusCode ?? 0));
        response.once("error", reject);
      },
    );
    request.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ECONNRESET" || error.code === "EPIPE") resolve("reset");
      else reject(error);
    });
    request.once("timeout", () => request.destroy(new Error("HTTP fixture timed out")));
    request.write('{"value":"');
    for (let index = 0; index < bytes; index += 1024) request.write("x".repeat(1024));
    request.end('"}');
  });

it("bounds declared and chunked bodies with the real Node readers and closes the listener", async () => {
  let acceptedBodies = 0;
  const handler = RequestBodyLimitMiddleware(
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      if (request.url === "/oauth/token") yield* request.urlParamsBody;
      else if (request.url === "/t/traces/v1") yield* request.arrayBuffer;
      else yield* request.json;
      acceptedBodies += 1;
      return HttpServerResponse.empty({ status: 204 });
    }).pipe(Effect.catch(() => Effect.succeed(HttpServerResponse.empty({ status: 400 })))),
  );

  const runtime = ManagedRuntime.make(
    Layer.effectDiscard(
      Effect.gen(function* () {
        const server = yield* HttpServer.HttpServer;
        yield* server.serve(handler);
      }),
    ).pipe(
      Layer.provideMerge(NodeHttpServer.layer(createHttpServer, { host: "127.0.0.1", port: 0 })),
    ),
  );

  let origin = "";
  try {
    const address = await runtime.runPromise(
      Effect.map(HttpServer.HttpServer, (server) => server.address),
    );
    if (!Predicate.isTagged(address, "TcpAddress")) throw new Error("Expected TCP listener");
    origin = `http://127.0.0.1:${address.port}`;
    const post = (path: string, body: string) =>
      fetch(`${origin}${path}`, {
        method: "POST",
        body,
        signal: AbortSignal.timeout(5_000),
      });

    for (const [path, limit] of [
      ["/oauth/token", 64 * 1024],
      ["/executions/prepare", 2 * 1024 * 1024],
      ["/t/traces/v1", 2 * 1024 * 1024],
    ] as const) {
      const before = acceptedBodies;
      const declared = await post(path, "x".repeat(limit + 1));
      expect(declared.status).toBe(413);
      expect(declared.headers.get("cache-control")).toBe("no-store");
      await declared.text();
      // Node can close an oversized incoming stream before a 400 is encoded.
      expect([400, "reset"]).toContain(await postChunked(`${origin}${path}`, limit + 1024));
      expect(acceptedBodies).toBe(before);
      const healthy = await post(path, "{}");
      expect(healthy.status).toBe(204);
      await healthy.text();
      expect(acceptedBodies).toBe(before + 1);
    }
  } finally {
    await runtime.dispose();
  }
  await expect(fetch(origin, { signal: AbortSignal.timeout(1_000) })).rejects.toThrow();
});
