import { expect, layer } from "@effect/vitest";
import { Effect, Ref, Result } from "effect";
import { TestClock } from "effect/testing";

import { Database, Repository, credentials, signingKey } from "@namera-ai/database";
import { makeTestEvmSessionService } from "@namera-ai/evm";
import { OneClawTestControl, oneClawAccountTestLayer } from "@namera-ai/wallet-provider-oneclaw";

import {
  createMember,
  makeTestApiClient,
  resetTestState,
  setAuthToken,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import { makeTestConfigLayer } from "../../fixtures/layers/config.js";
import { makeTestServerLayer } from "../../fixtures/layers/index.js";
import { createTestPasskeyWallet, localSessionRequest } from "../../fixtures/local-session.js";

const Live = makeTestServerLayer(
  { sessions: makeTestEvmSessionService() },
  undefined,
  makeTestConfigLayer({
    ONECLAW_PLATFORM_APP_ID: "test-app",
    ONECLAW_ORG_EMAIL_DOMAIN: "example.invalid",
  }),
  undefined,
  oneClawAccountTestLayer(),
);
const managedSigner = {
  custody: "namera-managed",
  provider: "1claw",
  algorithm: "secp256k1",
} as const;
const setup = Effect.gen(function* () {
  yield* resetTestState();
  yield* TestClock.setTime(Date.now());
  const control = yield* OneClawTestControl;
  yield* Ref.set(control.calls, []);
  yield* Ref.set(control.failNext, undefined);
  const client = yield* makeTestApiClient;
  const actor = yield* signIn(client, testEmail(`${crypto.randomUUID()}@example.com`));
  const wallet = yield* createTestPasskeyWallet(client);
  const request = { ...(yield* localSessionRequest(wallet.id)), signer: managedSigner };
  return {
    client,
    wallet,
    request,
    control,
    organizationId: actor.actor.organization.id,
    repository: yield* Repository,
  };
});

layer(Live)("1Claw session creation", (it) => {
  it.effect(
    "sets up a passkey org once and creates dedicated pending signers under either owner",
    () =>
      Effect.gen(function* () {
        const { client, request, control, repository, organizationId } = yield* setup;
        const first = yield* client.sessionKey.create({ payload: request });
        expect(first.status).toBe("pending");
        expect(first.signer).toMatchObject(managedSigner);
        expect(first.installations.every((installation) => installation.status === "pending")).toBe(
          true,
        );
        expect(
          JSON.stringify(first, (_, value) => (typeof value === "bigint" ? String(value) : value)),
        ).not.toMatch(/credentialId|agentId|providerKeyId|encryptedPayload|test-agent-key/);
        const account = yield* client.wallet.create({
          payload: {
            namespace: "eip155",
            owner: { type: "namera-managed", provider: "1claw" },
            metadata: { version: 1, name: "Managed parent" },
          },
        });
        const second = yield* client.sessionKey.create({
          payload: { ...request, walletId: account.id },
        });
        const firstKey = yield* repository.core.signingKey.findById(
          first.signingKeyId,
          organizationId,
        );
        const secondKey = yield* repository.core.signingKey.findById(
          second.signingKeyId,
          organizationId,
        );
        const parent = yield* repository.core.wallet.findById(account.id, organizationId);
        expect(firstKey).toMatchObject({
          purpose: "session",
          custody: "namera-managed",
          data: { type: "1claw", chain: "ethereum" },
        });
        expect(secondKey?.id).not.toBe(parent?.signingKey.id);
        expect(secondKey?.publicKeyHex).not.toBe(parent?.signingKey.publicKeyHex);
        expect(firstKey?.providerConnectionId).toBe(secondKey?.providerConnectionId);
        if (!firstKey?.credentialId) return yield* Effect.die("Missing agent credential");
        const credential = yield* repository.core.credentials.findById(
          firstKey.credentialId,
          organizationId,
        );
        expect(credential?.encryptedPayload).toBeTruthy();
        expect(credential?.encryptedPayload).not.toContain("test-agent-key");
        const calls = yield* Ref.get(control.calls);
        expect(calls.filter((op) => op === "connections.bootstrapEmpty")).toHaveLength(1);
        expect(calls.filter((op) => op === "customers.enableDelegation")).toHaveLength(1);
        expect(calls.filter((op) => op === "agents.create")).toHaveLength(3);
        expect(calls).not.toContain("signing.signDigest");
        const audit = yield* repository.audit.organization.findForOrganization(organizationId);
        expect(audit.filter((event) => event.event === "session_key.created")).toHaveLength(2);
        expect(
          yield* repository.core.sessionKey.activate(first.id, organizationId),
        ).toBeUndefined();
        expect(
          yield* client.apiKey
            .create({
              payload: {
                metadata: { version: 1, name: "Not installed" },
                durationDays: 1,
                sessionKeyIds: [first.id],
              },
            })
            .pipe(Effect.flip),
        ).toMatchObject({ _tag: "ApiKeyCreationError" });
      }),
  );

  it.effect(
    "enforces managed capacity independently of local sessions before provider allocation",
    () =>
      Effect.gen(function* () {
        const { client, wallet, request, control } = yield* setup;
        for (let i = 0; i < 5; i++) yield* client.sessionKey.create({ payload: request });
        const calls = yield* Ref.get(control.calls);
        expect(
          yield* client.sessionKey.create({ payload: request }).pipe(Effect.flip),
        ).toMatchObject({ _tag: "BillingError", limit: "oneClawSessionKeys" });
        expect(yield* Ref.get(control.calls)).toEqual(calls);
        yield* client.sessionKey.create({ payload: yield* localSessionRequest(wallet.id) });
        expect(yield* client.sessionKey.listForOrganization()).toHaveLength(6);
      }),
  );

  it.effect(
    "rejects expired policies, foreign wallets and unauthorized users before provisioning",
    () =>
      Effect.gen(function* () {
        const { client, request, control } = yield* setup;
        expect(
          yield* client.sessionKey
            .create({
              payload: {
                ...request,
                onchain: { ...request.onchain, validAfter: 0, validUntil: 1 },
              },
            })
            .pipe(Effect.flip),
        ).toMatchObject({ code: "TIME_WINDOW_EXPIRED" });
        yield* signIn(client, testEmail(`${crypto.randomUUID()}@example.com`));
        expect(
          yield* client.sessionKey.create({ payload: request }).pipe(Effect.flip),
        ).toMatchObject({ code: "WALLET_NOT_FOUND" });
        const member = yield* createMember(client, testEmail(`${crypto.randomUUID()}@example.com`));
        yield* setAuthToken(member.memberToken);
        expect(
          yield* client.sessionKey.create({ payload: request }).pipe(Effect.flip),
        ).toMatchObject({ _tag: "Forbidden" });
        expect(yield* Ref.get(control.calls)).toEqual([]);
      }),
  );

  it.effect("does not repeat an ambiguous bootstrap and rate limits managed attempts", () =>
    Effect.gen(function* () {
      const { client, request, control } = yield* setup;
      yield* Ref.set(control.failNext, "connections.bootstrapEmpty");
      yield* client.sessionKey.create({ payload: request }).pipe(Effect.flip);
      for (let i = 1; i < 20; i++)
        expect(
          yield* client.sessionKey.create({ payload: request }).pipe(Effect.flip),
        ).toMatchObject({ code: "PROVIDER_RECOVERY_REQUIRED" });
      expect(yield* client.sessionKey.create({ payload: request }).pipe(Effect.flip)).toMatchObject(
        { _tag: "RateLimitExceeded" },
      );
      const calls = yield* Ref.get(control.calls);
      expect(calls.filter((op) => op === "connections.bootstrapEmpty")).toHaveLength(1);
      expect(calls).not.toContain("agents.create");
    }),
  );

  it.effect(
    "preserves encrypted credentials after key creation fails without retrying the call",
    () =>
      Effect.gen(function* () {
        const { client, request, control, repository, organizationId } = yield* setup;
        yield* Ref.set(control.failNext, "signingKeys.create");
        expect(
          yield* client.sessionKey.create({ payload: request }).pipe(Effect.flip),
        ).toMatchObject({ code: "PROVIDER_RECOVERY_REQUIRED" });
        expect(yield* client.sessionKey.listForOrganization()).toEqual([]);
        const events = yield* repository.audit.organization.findForOrganization(organizationId);
        expect(
          events.filter(
            (event) =>
              event.event === "provider_credential.saved" && event.data.type === "1claw-agent",
          ),
        ).toHaveLength(1);
        expect(events.some((event) => event.event === "session_key.created")).toBe(false);
        expect(
          (yield* Ref.get(control.calls)).filter((op) => op === "signingKeys.create"),
        ).toHaveLength(1);
      }),
  );

  it.effect(
    "rolls back the session and signer after provider success but retains recovery credentials",
    () =>
      Effect.gen(function* () {
        const { client, request, repository, organizationId, control } = yield* setup;
        const db = yield* Database;
        yield* db.execute(
          "ALTER TABLE core.session_key ADD CONSTRAINT phase12_reject_insert CHECK (false) NOT VALID",
        );
        yield* Effect.gen(function* () {
          expect(
            yield* client.sessionKey.create({ payload: request }).pipe(Effect.flip),
          ).toMatchObject({ code: "PROVIDER_RECOVERY_REQUIRED" });
          expect(yield* client.sessionKey.listForOrganization()).toEqual([]);
          expect(
            (yield* db.select().from(signingKey)).filter((key) => key.purpose === "session"),
          ).toEqual([]);
          expect(yield* db.select().from(credentials)).toHaveLength(2);
          expect(
            (yield* repository.audit.organization.findForOrganization(organizationId)).some(
              (event) => event.event === "session_key.created",
            ),
          ).toBe(false);
          expect(
            (yield* client.notification.list({ query: {} })).items.some(
              (entry) => entry.notification.type === "session_key.created",
            ),
          ).toBe(false);
          expect(yield* Ref.get(control.calls)).toContain("agents.setRawSigningEnabled");
        }).pipe(
          Effect.ensuring(
            db
              .execute("ALTER TABLE core.session_key DROP CONSTRAINT phase12_reject_insert")
              .pipe(Effect.orDie),
          ),
        );
      }),
  );

  if (process.env.NAMERA_TEST_POSTGRES_PORT !== undefined) {
    it.effect("admits only one concurrent request at the last managed-session slot", () =>
      Effect.gen(function* () {
        const { client, request } = yield* setup;
        for (let i = 0; i < 4; i++) yield* client.sessionKey.create({ payload: request });
        const results = yield* Effect.all(
          Array.from({ length: 5 }, () =>
            client.sessionKey.create({ payload: request }).pipe(Effect.result),
          ),
          { concurrency: "unbounded" },
        );
        expect(results.filter(Result.isSuccess)).toHaveLength(1);
        expect(yield* client.sessionKey.listForOrganization()).toHaveLength(5);
      }),
    );
  }
});
