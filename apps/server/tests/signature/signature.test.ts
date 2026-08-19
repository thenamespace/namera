import { expect, layer } from "@effect/vitest";
import { DateTime, Duration, Effect } from "effect";

import { Repository } from "@namera-ai/database";

import {
  makeTestApiClient,
  resetTestState,
  setApiKey,
  setAuthToken,
  signIn,
  testEmail,
} from "../helpers/index.js";
import { TestServerLayer } from "../layers/index.js";

const metadata = (name: string) => ({ version: 1 as const, name });

layer(TestServerLayer)("signature routes", (it) => {
  it.effect("signs messages and typed data through an explicitly authorized session key", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("signature-owner@example.com"));
      const wallet = yield* client.wallet.create({
        payload: {
          namespace: "eip155",
          implementation: "kernel",
          protectionLevel: "software",
          metadata: metadata("Signing account"),
        },
      });
      const sessionKey = yield* client.sessionKey.create({
        payload: {
          namespace: "eip155",
          walletId: wallet.id,
          metadata: metadata("Signing key"),
          policies: [
            {
              type: "evm.time-window",
              version: 1,
              startsAt: null,
              expiresAt: DateTime.addDuration(yield* DateTime.now, Duration.days(1)),
            },
            {
              type: "evm.signature",
              version: 1,
              allowedTypes: ["message", "typed-data"],
            },
          ],
        },
      });
      const apiKey = yield* client.apiKey.create({
        payload: {
          metadata: metadata("Signing agent"),
          durationDays: 7,
          sessionKeyIds: [sessionKey.id],
        },
      });
      yield* setAuthToken();
      yield* setApiKey(apiKey.key);

      const message = yield* client.signature.sign({
        headers: { "idempotency-key": "signature-message-1" },
        payload: {
          namespace: "eip155",
          type: "message",
          walletId: wallet.id,
          chainId: "eip155:1",
          message: "Authorize this action",
        },
      });
      expect(message).toMatchObject({
        namespace: "eip155",
        type: "message",
        walletId: wallet.id,
        account: wallet.address,
        signature: "0x1234",
      });

      const conflict = yield* client.signature
        .sign({
          headers: { "idempotency-key": "signature-message-1" },
          payload: {
            namespace: "eip155",
            type: "message",
            walletId: wallet.id,
            chainId: "eip155:1",
            message: "A different request",
          },
        })
        .pipe(Effect.flip);
      expect(conflict).toMatchObject({
        _tag: "SignatureError",
        code: "IDEMPOTENCY_CONFLICT",
      });

      const typedData = yield* client.signature.sign({
        headers: { "idempotency-key": "signature-typed-data-1" },
        payload: {
          namespace: "eip155",
          type: "typed-data",
          walletId: wallet.id,
          chainId: "eip155:1",
          typedData: {
            domain: { name: "Namera", version: "1", chainId: 1 },
            types: { Authorization: [{ name: "action", type: "string" }] },
            primaryType: "Authorization",
            message: { action: "test" },
          },
        },
      });
      expect(typedData).toMatchObject({ type: "typed-data", signature: "0x1234" });

      const repository = yield* Repository;
      const messageOperation =
        yield* repository.core.signatureOperation.findByActorAndIdempotencyKey(
          owner.actor.organization.id,
          apiKey.apiKey.actorId,
          "signature-message-1",
        );
      expect(messageOperation).toMatchObject({
        status: "succeeded",
        namespace: "eip155",
        data: {
          type: "message",
          chainId: "eip155:1",
          account: wallet.address,
          message: "Authorize this action",
          payloadSizeBytes: 21,
        },
      });

      const typedDataOperation =
        yield* repository.core.signatureOperation.findByActorAndIdempotencyKey(
          owner.actor.organization.id,
          apiKey.apiKey.actorId,
          "signature-typed-data-1",
        );
      expect(typedDataOperation).toMatchObject({
        status: "succeeded",
        data: {
          type: "typed-data",
          typedData: {
            domain: { name: "Namera", version: "1", chainId: 1 },
            primaryType: "Authorization",
            message: { action: "test" },
          },
        },
      });
      yield* setApiKey();
      yield* setAuthToken(owner.cookie.value);
      expect((yield* client.billing.get()).usage.signatures).toBe(2);

      const events = yield* repository.audit.organization.findForOrganization(
        owner.actor.organization.id,
      );
      expect(events.filter(({ event }) => event === "signature.created")).toHaveLength(2);
    }),
  );

  it.effect("rejects grants without the requested signature capability", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("signature-denied@example.com"));
      const wallet = yield* client.wallet.create({
        payload: {
          namespace: "eip155",
          implementation: "kernel",
          protectionLevel: "software",
          metadata: metadata("Restricted account"),
        },
      });
      const sessionKey = yield* client.sessionKey.create({
        payload: {
          namespace: "eip155",
          walletId: wallet.id,
          metadata: metadata("Message-only key"),
          policies: [
            {
              type: "evm.time-window",
              version: 1,
              startsAt: null,
              expiresAt: DateTime.addDuration(yield* DateTime.now, Duration.days(1)),
            },
            { type: "evm.signature", version: 1, allowedTypes: ["message"] },
          ],
        },
      });
      const apiKey = yield* client.apiKey.create({
        payload: {
          metadata: metadata("Restricted agent"),
          durationDays: 7,
          sessionKeyIds: [sessionKey.id],
        },
      });
      yield* setAuthToken();
      yield* setApiKey(apiKey.key);

      const error = yield* client.signature
        .sign({
          headers: { "idempotency-key": "signature-denied-1" },
          payload: {
            namespace: "eip155",
            type: "typed-data",
            walletId: wallet.id,
            chainId: "eip155:1",
            typedData: {
              domain: {},
              types: { Authorization: [{ name: "action", type: "string" }] },
              primaryType: "Authorization",
              message: { action: "denied" },
            },
          },
        })
        .pipe(Effect.flip);
      expect(error).toMatchObject({
        _tag: "SignatureError",
        code: "POLICY_DENIED",
        policyCode: "SIGNATURE_TYPE_NOT_ALLOWED",
      });
    }),
  );
});
