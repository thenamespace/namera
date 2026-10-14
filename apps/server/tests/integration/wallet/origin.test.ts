import { expect, layer } from "@effect/vitest";
import { Effect, Layer, Ref } from "effect";
import { HttpEffect, HttpRouter, HttpServerRequest, type HttpServerResponse } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";
import { TestClock } from "effect/testing";

import { NameraApi } from "@namera-ai/api";
import { Database, Repository } from "@namera-ai/database";
import { OneClawTestControl, oneClawAccountTestLayer } from "@namera-ai/wallet-provider-oneclaw";

import { CorsMiddleware } from "#/middlewares/cors";

import { makeTestApiClient, resetTestState, signIn, testEmail } from "../../fixtures/index.js";
import { makeTestConfigLayer } from "../../fixtures/layers/config.js";
import { makeTestServerLayer } from "../../fixtures/layers/index.js";

const live = makeTestServerLayer(
  {},
  undefined,
  makeTestConfigLayer({
    ONECLAW_PLATFORM_APP_ID: "test-app",
    ONECLAW_ORG_EMAIL_DOMAIN: "example.invalid",
  }),
  undefined,
  oneClawAccountTestLayer(),
);

layer(live)("wallet mutation Origin", (it) => {
  it.effect("rejects untrusted requests without changing ceremonies or provisioning accounts", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      yield* TestClock.setTime(Date.now());
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("wallet-origin@example.com"));
      const control = yield* OneClawTestControl;
      yield* Ref.set(control.calls, []);
      const registration = yield* client.wallet.createPasskeyRegistrationOptions();
      const payload = {
        namespace: "eip155" as const,
        owner: {
          type: "passkey" as const,
          verificationId: registration.verificationId,
          response: {
            id: "test-passkey",
            rawId: "test-passkey",
            type: "public-key" as const,
            response: {
              clientDataJSON: "dGVzdA",
              attestationObject: "dGVzdA",
              transports: ["internal"],
            },
            clientExtensionResults: {},
          },
        },
        metadata: { version: 1 as const, name: "Original" },
      };
      const wallet = yield* client.wallet.create({
        payload: {
          namespace: "eip155",
          owner: { type: "namera-managed", provider: "1claw" },
          metadata: payload.metadata,
        },
      });
      const pending = yield* client.wallet.createPasskeyRegistrationOptions();
      const db = yield* Database;
      const repository = yield* Repository;
      const snapshot = Effect.gen(function* () {
        return {
          verifications: yield* db.query.verification.findMany(),
          wallets: yield* client.wallet.list(),
          keys: yield* db.query.signingKey.findMany(),
          provisioning: yield* db.query.signerProvisioning.findMany(),
          billing: yield* client.billing.get(),
          audit: (yield* repository.audit.organization.findForOrganization(
            owner.actor.organization.id,
          )).toSorted((a, b) => a.id.localeCompare(b.id)),
          emails: yield* db.query.emailJob.findMany(),
          notifications: yield* client.notification.list({ query: {} }),
          providerCalls: yield* Ref.get(control.calls),
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
      const cases = [
        {
          path: "/wallets",
          payload: {
            ...payload,
            owner: { ...payload.owner, verificationId: pending.verificationId },
          },
        },
        {
          path: "/wallets",
          payload: {
            namespace: "eip155",
            owner: { type: "namera-managed", provider: "1claw" },
            metadata: payload.metadata,
            idempotencyKey: crypto.randomUUID(),
          },
        },
        {
          path: `/wallets/${wallet.id}/update`,
          payload: { metadata: { version: 1, name: "Updated" } },
        },
        { path: "/wallets/passkey/registration-options", payload: undefined },
      ];
      for (const test of cases) {
        for (const origin of [
          undefined,
          "null",
          "https://evil.example",
          "http://untrusted.api.test",
          "http://dashboard.test",
        ]) {
          for (const contentType of test.payload === undefined || origin === "http://dashboard.test"
            ? [undefined]
            : [undefined, "application/json", "text/plain"]) {
            const before = yield* snapshot;
            const request = new Request(`http://api.test${test.path}`, {
              method: "POST",
              headers: {
                cookie: `auth-token=${owner.cookie.value}`,
                ...(origin === undefined ? {} : { origin }),
                ...(contentType === undefined ? {} : { "content-type": contentType }),
              },
              ...(test.payload === undefined
                ? {}
                : { body: new TextEncoder().encode(JSON.stringify(test.payload)) }),
            });
            let response: HttpServerResponse.HttpServerResponse | undefined;
            yield* HttpEffect.toHandled(handler, (_, result) =>
              Effect.sync(() => {
                response = result;
              }),
            ).pipe(
              Effect.provideService(
                HttpServerRequest.HttpServerRequest,
                HttpServerRequest.fromWeb(request),
              ),
            );
            expect(response?.headers["cache-control"]).toBe("no-store");
            if (origin === "http://dashboard.test") {
              expect(response?.status, test.path).toBe(test.path === "/wallets" ? 201 : 200);
              expect(yield* snapshot).not.toEqual(before);
            } else {
              expect(response?.status).toBe(contentType === "text/plain" ? 415 : 403);
              expect(yield* snapshot).toEqual(before);
            }
          }
        }
      }
      expect((yield* client.wallet.get({ params: { walletId: wallet.id } })).metadata.name).toBe(
        "Updated",
      );
      expect(
        (yield* Ref.get(control.calls)).filter((call) => call === "agents.create"),
      ).toHaveLength(2);
    }),
  );
});
