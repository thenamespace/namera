import { DateTime, Duration, Effect } from "effect";

import { NameraApi } from "@namera-ai/api";
import { bootstrapPlatformOwner } from "@namera-ai/application";
import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository } from "@namera-ai/database";
import type { PlatformRole } from "@namera-ai/protocol/model";

import { testEmail } from "./data.js";
import { handledApi } from "./http-api-test.js";

export const platformIdentity = Effect.fnUntraced(function* (
  emailValue = "platform-owner@example.com",
  role: PlatformRole = "owner",
) {
  const repository = yield* Repository;
  const crypto = yield* CryptoService;
  const email = testEmail(emailValue);
  const now = yield* DateTime.now;
  let user = yield* repository.auth.user.findByEmail(email);
  if (!user) {
    user = yield* repository.auth.user.create({ email, metadata: { version: 1 } });
    yield* repository.auth.user.markEmailVerifiedAndLogin(user.id, now);
  }
  let member = yield* repository.auth.platform.findMember(user.id);
  if (!member)
    member =
      role === "owner"
        ? yield* bootstrapPlatformOwner(email)
        : yield* repository.auth.platform.createMember({ userId: user.id, role });
  const token = yield* crypto.randomToken(32);
  const session = yield* repository.auth.session.create({
    userId: user.id,
    tokenHash: yield* crypto.hash({ purpose: cryptoPurpose.sessionToken, value: token }),
    expiresAt: DateTime.addDuration(now, Duration.days(30)),
  });
  const headers = { cookie: `auth-token=${token}`, origin: "http://dashboard.test" };
  return {
    user,
    member,
    session,
    token,
    headers,
    client: yield* handledApi(NameraApi, { headers }),
  };
});

export const platformClient = Effect.gen(function* () {
  return (yield* platformIdentity()).client;
});
