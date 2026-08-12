import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";
import {
  HttpClientRequest,
  HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";

import { RootRoutes } from "#/routes/root";

layer(HttpServer.layerServices)("root route", (it) => {
  it.effect("returns the API identity", () =>
    Effect.gen(function* () {
      const handler = yield* HttpRouter.toHttpEffect(RootRoutes);
      const request = HttpClientRequest.get("http://localhost/");
      const serverRequest = HttpServerRequest.fromClientRequest(request);
      const response = yield* handler.pipe(
        Effect.provideService(HttpServerRequest.HttpServerRequest, serverRequest),
      );
      const clientResponse = HttpServerResponse.toClientResponse(response, { request });

      expect(clientResponse.status).toBe(200);
      expect(yield* clientResponse.text).toBe("Namera API");
    }),
  );
});
