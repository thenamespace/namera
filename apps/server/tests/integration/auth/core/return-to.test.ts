import { expect, layer } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { HttpEffect, HttpRouter, HttpServerRequest, type HttpServerResponse } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";

import { NameraApi } from "@namera-ai/api";
import { Application, googleIdentityTestLayer } from "@namera-ai/application";
import { Database, Repository, verification } from "@namera-ai/database";
import { Passkeys } from "@namera-ai/passkeys";
import { VerificationId } from "@namera-ai/protocol";

import { seedBetaInvite } from "../../../fixtures/beta-invite.js";
import { handledApi } from "../../../fixtures/http-api-test.js";
import { requestMagicLink, resetTestState, testEmail } from "../../../fixtures/index.js";
import { makeTestConfigLayer } from "../../../fixtures/layers/config.js";
import { makeTestServerLayer } from "../../../fixtures/layers/index.js";

const provider = googleIdentityTestLayer({
  alice: {
    subject: "return-to-alice",
    email: testEmail("alice@gmail.com"),
    emailAuthoritative: true,
  },
});

const betaLayer = makeTestServerLayer(
  {},
  Passkeys.testLayer,
  makeTestConfigLayer({ AUTH_INVITE_REQUIRED: "true" }),
  provider,
);
layer(betaLayer)("restricted sign-in return paths", (it) => {
  for (const method of ["google", "magic-link"] as const) {
    for (const [returnTo, expected] of [
      ["/settings/..//attacker.example", "/"],
      ["/identity?tab=profile#avatar", "/identity?tab=profile#avatar"],
    ] as const) {
      it.effect(
        `${method} preserves a safe destination through invite redemption: ${returnTo}`,
        () =>
          Effect.gen(function* () {
            yield* resetTestState();
            let admissionToken: string | undefined;
            if (method === "google") {
              const app = yield* Application;
              const started = yield* app.google.start({ returnTo });
              const url = new URL(started.authorizationUrl);
              const pending = yield* app.google.complete(
                {
                  state: url.searchParams.get("state") ?? "",
                  browserToken: started.browserToken,
                  code: `alice:${url.searchParams.get("nonce")}`,
                },
                { ipAddress: null, userAgent: null },
              );
              expect(pending.returnTo).toBe("/auth/invite");
              if ("admissionToken" in pending) admissionToken = pending.admissionToken;
            } else {
              const client = yield* browser;
              const link = yield* requestMagicLink(
                client,
                testEmail("restricted@example.com"),
                returnTo,
              );
              const [pending, response] = yield* client.magicLink.verify({
                payload: { type: "token", id: link.id, token: link.token },
                responseMode: "decoded-and-response",
              });
              expect(pending.body.returnTo).toBe("/auth/invite");
              admissionToken = response.cookies.cookies["beta-signup"]?.value;
            }
            expect(admissionToken).toBeTruthy();
            const invite = yield* seedBetaInvite();
            const client = yield* handledApi(NameraApi, {
              headers: { cookie: `beta-signup=${admissionToken}` },
            });
            const [completed, response] = yield* client.magicLink.redeemInvite({
              payload: { inviteCode: invite.code },
              responseMode: "decoded-and-response",
            });
            expect(completed.body.returnTo).toBe(expected);
            expect(response.cookies.cookies["auth-token"]?.value).toBeTruthy();
          }),
      );
    }
  }
});
const testLayer = makeTestServerLayer({}, Passkeys.testLayer, makeTestConfigLayer(), provider);
const browser = handledApi(NameraApi, { headers: { origin: "http://dashboard.test" } });

layer(testLayer)("sign-in return paths", (it) => {
  it.effect("revalidates unsafe return paths in existing Google flows", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const app = yield* Application;
      const started = yield* app.google.start({ returnTo: "/settings" });
      const url = new URL(started.authorizationUrl);
      const state = url.searchParams.get("state") ?? "";
      const id = Schema.decodeSync(VerificationId)(state.split(".")[0] ?? "");
      const flow = yield* (yield* Repository).auth.verification.findById(id);
      if (!flow || flow.purpose !== "google-auth") return yield* Effect.die("Missing Google flow");
      const changed = yield* (yield* Database)
        .update(verification)
        .set({ data: { ...flow.data, returnTo: "//attacker.example" } })
        .returning({ id: verification.id });
      expect(changed).toEqual([{ id }]);
      const completed = yield* app.google.complete(
        {
          state,
          browserToken: started.browserToken,
          code: `alice:${url.searchParams.get("nonce")}`,
        },
        { ipAddress: null, userAgent: null },
      );
      expect(completed.returnTo).toBe("/");
    }),
  );
  for (const [returnTo, expected] of [
    ["/settings/..//attacker.example", "/"],
    ["/settings/%2e%2e//attacker.example", "/"],
    ["/settings/profile?tab=security#keys", "/settings/profile?tab=security#keys"],
  ] as const) {
    it.effect(`Google callback confines ${returnTo} to the dashboard`, () =>
      Effect.gen(function* () {
        yield* resetTestState();
        const client = yield* browser;
        const [started, response] = yield* client.google.start({
          payload: { returnTo },
          responseMode: "decoded-and-response",
        });
        const authorization = new URL(started.authorizationUrl);
        const url = new URL("http://api.test/auth/google/callback");
        url.search = new URLSearchParams({
          state: authorization.searchParams.get("state") ?? "",
          code: `alice:${authorization.searchParams.get("nonce")}`,
        }).toString();
        const handler = yield* HttpRouter.toHttpEffect(HttpApiBuilder.layer(NameraApi));
        let completed: HttpServerResponse.HttpServerResponse | undefined;
        yield* HttpEffect.toHandled(handler, (_request, result) =>
          Effect.sync(() => {
            completed = result;
          }),
        ).pipe(
          Effect.provideService(
            HttpServerRequest.HttpServerRequest,
            HttpServerRequest.fromWeb(
              new Request(url, {
                headers: {
                  cookie: `google-auth=${response.cookies.cookies["google-auth"]?.value}`,
                },
              }),
            ),
          ),
        );
        expect(completed?.status).toBe(302);
        expect(completed?.headers.location).toBe(
          new URL(expected, "http://dashboard.test").toString(),
        );
        expect(completed?.cookies.cookies["auth-token"]?.value).toBeTruthy();
      }),
    );

    it.effect(`magic-link safely completes ${returnTo}`, () =>
      Effect.gen(function* () {
        yield* resetTestState();
        const client = yield* browser;
        const link = yield* requestMagicLink(
          client,
          testEmail("return-path@example.com"),
          returnTo,
        );
        const result = yield* client.magicLink.verify({
          payload: { type: "token", id: link.id, token: link.token },
        });
        expect(result.body.returnTo).toBe(expected);
      }),
    );
  }
});
