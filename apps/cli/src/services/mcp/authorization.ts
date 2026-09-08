import { Effect, Result } from "effect";
import {
  HttpEffect,
  HttpMiddleware,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";

import { CurrentLocalMcpPrincipal, LocalMcpApi } from "./api-client.js";
import { localMcpResponseHeaders } from "./http-security.js";
import { LocalMcpOAuth } from "./oauth-broker.js";
import type { LocalMcpUrls } from "./transport-security.js";

export const localMcpAuthorization = (urls: LocalMcpUrls) => {
  const sessions = new Map<
    string,
    { readonly clientId: string; readonly authorizationId: string }
  >();
  let initializations = 0;
  const unauthorized = () =>
    HttpServerResponse.empty({
      status: 401,
      headers: {
        ...localMcpResponseHeaders,
        "www-authenticate": `Bearer resource_metadata="${urls.resourceMetadata}", scope="mcp:read"`,
      },
    });
  return HttpMiddleware.make((next) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      if (request.url.split("?", 1)[0] !== "/mcp") return yield* next;
      const header = request.headers.authorization;
      const token =
        header && header.length <= 2048 ? /^Bearer\s+(\S+)$/i.exec(header)?.[1] : undefined;
      if (!token) return unauthorized();
      const broker = yield* LocalMcpOAuth;
      const api = yield* LocalMcpApi;
      const principalResult = yield* broker
        .authenticate(token)
        .pipe(Effect.flatMap(api.authenticate), Effect.result);
      if (Result.isFailure(principalResult)) {
        return principalResult.failure instanceof Error &&
          "code" in principalResult.failure &&
          principalResult.failure.code === "temporarily_unavailable"
          ? HttpServerResponse.empty({ status: 503, headers: localMcpResponseHeaders })
          : unauthorized();
      }
      const principal = principalResult.success;
      const sessionId = request.headers["mcp-session-id"];
      if (sessionId !== undefined) {
        const binding = sessions.get(sessionId);
        if (
          !binding ||
          binding.clientId !== principal.localClientId ||
          binding.authorizationId !== principal.actor.data.authorization.id
        )
          return unauthorized();
      } else {
        // Effect currently retains HTTP protocol sessions for the process lifetime.
        // Bound initialization rather than allowing that internal map to grow forever.
        if (sessions.size + initializations >= 128)
          return HttpServerResponse.empty({ status: 503, headers: localMcpResponseHeaders });
        initializations += 1;
      }
      const response = yield* next.pipe(
        Effect.provideService(CurrentLocalMcpPrincipal, principal),
        Effect.onError(() =>
          Effect.sync(() => {
            if (sessionId === undefined) initializations -= 1;
          }),
        ),
      );
      if (sessionId === undefined) {
        // Append after the protocol handler, which assigns its ID in this phase.
        yield* HttpEffect.appendPreResponseHandler((_request, completed) =>
          Effect.sync(() => {
            initializations -= 1;
            const created = completed.headers["mcp-session-id"];
            if (created !== undefined)
              sessions.set(created, {
                clientId: principal.localClientId,
                authorizationId: principal.actor.data.authorization.id,
              });
            return completed;
          }),
        );
      }
      return response;
    }),
  );
};
