import { expect, layer } from "@effect/vitest";
import { Effect, Layer, Ref } from "effect";
import { HttpEffect, HttpRouter, HttpServerRequest, type HttpServerResponse } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";

import { NameraApi } from "@namera-ai/api";
import { Database } from "@namera-ai/database";
import { createTestAuthenticator } from "@namera-ai/passkeys/testing";

import { CorsMiddleware } from "#/middlewares/cors";

import { makeTestConfigLayer } from "../../fixtures/layers/config.js";
import { localSessionRequest } from "../../fixtures/local-session.js";
import {
  prepareCustodyOperation,
  sessionCustodyLayer,
  setupSessionCustody,
} from "../../fixtures/session-custody.js";

for (const owner of ["passkey", "1claw"] as const) {
  layer(sessionCustodyLayer)(`${owner} session mutation Origin`, (it) => {
    it.effect("rejects untrusted origins before any authority, signing or billing mutation", () =>
      Effect.gen(function* () {
        const f = yield* setupSessionCustody(owner, "local");
        const installation = f.session.installations[0];
        if (!installation) return yield* Effect.die("Missing installation");
        const payload = {
          installationId: installation.id,
          kind: "install" as const,
          sponsor: false,
          idempotencyKey: crypto.randomUUID(),
        };
        const operation = yield* prepareCustodyOperation(f.client, owner, payload);
        const operationId = operation.prepared.operationId;
        const response = createTestAuthenticator().authenticate({
          challenge: "test-challenge",
          origin: "http://dashboard.test",
          rpId: "dashboard.test",
          counter: 0,
        });
        const cases = [
          { path: "/session-keys", payload: yield* localSessionRequest(f.wallet.id) },
          { path: `/session-keys/${f.session.id}/revoke`, payload: undefined },
          { path: `/session-keys/operations/${operationId}/cancel`, payload: undefined },
          { path: "/session-keys/operations/prepare", payload },
          { path: "/session-keys/operations/managed/prepare", payload },
          { path: "/session-keys/operations/complete", payload: { operationId, response } },
          { path: "/session-keys/operations/managed/approve", payload: { operationId } },
        ];
        const db = yield* Database;
        const snapshot = Effect.gen(function* () {
          return {
            sessions: yield* f.client.sessionKey.listForOrganization(),
            operations: yield* db.query.sessionKeyOperation.findMany(),
            keys: yield* db.query.signingKey.findMany(),
            billing: yield* f.client.billing.get(),
            audit: yield* f.repository.audit.organization.findForOrganization(f.organizationId),
            calls: yield* Ref.get(f.control.calls),
          };
        });
        const handler = yield* HttpRouter.toHttpEffect(
          Layer.merge(
            HttpApiBuilder.layer(NameraApi),
            CorsMiddleware.pipe(
              Layer.provide(makeTestConfigLayer({ SERVER_CORS_ORIGIN: "http://dashboard.test" })),
            ),
          ),
        );
        const before = yield* snapshot;
        for (const test of cases) {
          for (const origin of [undefined, "null", "https://evil.example", "not-an-origin"]) {
            for (const contentType of test.payload === undefined
              ? [undefined]
              : [undefined, "application/json", "text/plain"]) {
              const request = new Request(`http://api.test${test.path}`, {
                method: "POST",
                headers: {
                  cookie: `auth-token=${f.actor.cookie.value}`,
                  ...(origin === undefined ? {} : { origin }),
                  ...(contentType === undefined ? {} : { "content-type": contentType }),
                },
                ...(test.payload === undefined
                  ? {}
                  : { body: new TextEncoder().encode(JSON.stringify(test.payload)) }),
              });
              let result: HttpServerResponse.HttpServerResponse | undefined;
              yield* HttpEffect.toHandled(handler, (_, httpResponse) =>
                Effect.sync(() => {
                  result = httpResponse;
                }),
              ).pipe(
                Effect.provideService(
                  HttpServerRequest.HttpServerRequest,
                  HttpServerRequest.fromWeb(request),
                ),
              );
              expect(result?.status, test.path).toBe(contentType === "text/plain" ? 415 : 403);
              expect(result?.headers["cache-control"]).toBe("no-store");
            }
          }
        }
        expect(yield* snapshot).toEqual(before);
        // The normal client supplies the exact dashboard Origin; approval still works.
        expect((yield* operation.approve).status).toBe("signed");
      }),
    );
  });
}
