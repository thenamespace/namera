import { expect, layer } from "@effect/vitest";
import { Effect, Ref } from "effect";

import { setApiKey, setAuthToken, signIn, testEmail } from "../../fixtures/index.js";
import { setupManagedOperations } from "../../fixtures/managed-session-operations.js";
import { sessionCustodyLayer } from "../../fixtures/session-custody.js";

layer(sessionCustodyLayer)("managed operation admission", (it) => {
  it.effect("requires the creating machine actor even when another actor has the same grant", () =>
    Effect.gen(function* () {
      const f = yield* setupManagedOperations("1claw");
      const execution = yield* f.client.execution.prepareManaged(f.executionRequest);
      const signature = yield* f.client.signature.prepareManaged(f.signatureRequest);
      const executionCompletion = {
        payload: { namespace: "eip155" as const, submissionId: execution.submissionId },
      };
      const signatureCompletion = {
        payload: { namespace: "eip155" as const, operationId: signature.operationId },
      };
      yield* setApiKey();
      yield* setAuthToken(f.actor.cookie.value);
      yield* f.client.execution.completeManaged(executionCompletion).pipe(Effect.flip);
      yield* f.client.signature.completeManaged(signatureCompletion).pipe(Effect.flip);
      const other = yield* f.client.apiKey.create({
        payload: {
          metadata: { version: 1, name: "Other actor" },
          durationDays: 1,
          sessionKeyIds: [f.session.id],
        },
      });
      yield* setAuthToken();
      yield* setApiKey(other.key);
      expect(
        yield* f.client.execution.completeManaged(executionCompletion).pipe(Effect.flip),
      ).toMatchObject({ code: "EXECUTION_UNAVAILABLE" });
      expect(
        yield* f.client.signature.completeManaged(signatureCompletion).pipe(Effect.flip),
      ).toMatchObject({ code: "SIGNATURE_UNAVAILABLE" });
      expect(yield* Ref.get(f.control.calls)).toEqual([]);
      yield* setApiKey();
      yield* signIn(f.client, testEmail(`other-${crypto.randomUUID()}@example.com`));
      // Organization membership cannot authorize either public managed operation.
      yield* f.client.execution.prepareManaged(f.executionRequest).pipe(Effect.flip);
      yield* f.client.signature.prepareManaged(f.signatureRequest).pipe(Effect.flip);
      expect(yield* Ref.get(f.control.calls)).toEqual([]);
    }),
  );

  it.effect("denies disallowed chains before reserving or signing", () =>
    Effect.gen(function* () {
      const f = yield* setupManagedOperations("passkey", {
        allowSignatures: true,
        policies: [
          { type: "evm.chain-allowlist", version: 1, chainIds: ["eip155:84532"] },
          { type: "evm.signature", version: 1, allowedTypes: ["message"] },
        ],
      });
      expect(
        yield* f.client.execution.prepareManaged(f.executionRequest).pipe(Effect.flip),
      ).toMatchObject({ code: "POLICY_DENIED" });
      expect(
        yield* f.client.signature.prepareManaged(f.signatureRequest).pipe(Effect.flip),
      ).toMatchObject({ code: "POLICY_DENIED" });
      expect(
        yield* f.repository.core.executionSubmission.findByActorAndIdempotencyKey(
          f.organizationId,
          f.apiKey.apiKey.actorId,
          f.executionRequest.headers["idempotency-key"],
        ),
      ).toBeUndefined();
      expect(
        yield* f.repository.core.signatureOperation.findByActorAndIdempotencyKey(
          f.organizationId,
          f.apiKey.apiKey.actorId,
          f.signatureRequest.headers["idempotency-key"],
        ),
      ).toBeUndefined();
      expect(yield* Ref.get(f.control.calls)).toEqual([]);
    }),
  );

  it.effect("binds prepared signatures to the original payload and active installation", () =>
    Effect.gen(function* () {
      const f = yield* setupManagedOperations("passkey");
      yield* f.client.signature.prepareManaged(f.signatureRequest);
      expect(
        yield* f.client.signature
          .prepareManaged({
            ...f.signatureRequest,
            payload: { ...f.signatureRequest.payload, message: "Different payload" },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
      yield* f.client.signature
        .prepareManaged({
          ...f.signatureRequest,
          headers: { "idempotency-key": crypto.randomUUID() },
          payload: { ...f.signatureRequest.payload, chainId: "eip155:84532" },
        })
        .pipe(Effect.flip);
      expect(yield* Ref.get(f.control.calls)).toEqual([]);
    }),
  );
});
