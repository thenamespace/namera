import { DateTime, Duration, Effect, Schema } from "effect";

import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository } from "@namera-ai/database";
import { VerificationId, type Email } from "@namera-ai/protocol";
import { MagicLinkToken, type UserActorData } from "@namera-ai/protocol/dto";

import { TestEmails } from "../layers/index.js";
import { useAuthCookie, type TestApiClient } from "./api.js";

export const requestMagicLink = Effect.fn("requestMagicLink")(function* (
  client: TestApiClient,
  email: Email,
) {
  const [body, response] = yield* client.magicLink.request({
    payload: { email },
    responseMode: "decoded-and-response",
  });
  const emails = yield* TestEmails;
  const sent = yield* emails.latest;
  if (sent.type !== "magic-link") {
    return yield* Effect.die("Expected a magic-link email");
  }

  const url = new URL(sent.variables.magicLinkUrl);
  const id = url.searchParams.get("id");
  const token = url.searchParams.get("token");
  if (id === null || token === null) {
    return yield* Effect.die("Magic-link email did not contain verification credentials");
  }

  return {
    body: body.body,
    response,
    code: sent.variables.code,
    id: Schema.decodeSync(VerificationId)(id),
    token: Schema.decodeSync(MagicLinkToken)(token),
  };
});

export const signIn = Effect.fn("signIn")(function* (client: TestApiClient, email: Email) {
  const magicLink = yield* requestMagicLink(client, email);
  const [verification, response] = yield* client.magicLink.verify({
    payload: {
      type: "token",
      id: magicLink.id,
      token: magicLink.token,
    },
    responseMode: "decoded-and-response",
  });
  const cookie = yield* useAuthCookie(response);
  const actor = yield* client.session.currentUser();

  return { actor, cookie, verification: verification.body };
});

export const createSession = Effect.fn("createSession")(function* (
  actor: UserActorData,
  token = `test-session-${crypto.randomUUID()}`,
) {
  const cryptoService = yield* CryptoService;
  const repository = yield* Repository;
  const now = yield* DateTime.now;
  const tokenHash = yield* cryptoService.hash({
    purpose: cryptoPurpose.sessionToken,
    value: token,
  });
  const session = yield* repository.auth.session.create({
    userId: actor.user.id,
    tokenHash,
    activeOrganizationId: actor.organization.id,
    expiresAt: DateTime.addDuration(now, Duration.days(30)),
  });

  return { session, token };
});
