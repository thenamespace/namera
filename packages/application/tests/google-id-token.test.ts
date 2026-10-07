import { Effect } from "effect";

import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTVerifyGetKey } from "jose";
import { beforeAll, expect, it } from "vitest";

import { verifyGoogleIdToken } from "../src/auth/google/id-token.js";

let key: CryptoKey;
let keys: JWTVerifyGetKey;
beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  key = pair.privateKey;
  keys = createLocalJWKSet({
    keys: [{ ...(await exportJWK(pair.publicKey)), kid: "test-key", alg: "RS256" }],
  });
});
const sign = (claims: Record<string, unknown> = {}, signingKey = key) =>
  new SignJWT({
    sub: "google-subject",
    email: "alice@gmail.com",
    email_verified: true,
    nonce: "browser-nonce",
    iss: "https://accounts.google.com",
    aud: "test-client",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300,
    ...claims,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .sign(signingKey);

it("verifies a signed Google identity without trusting email as its identifier", async () => {
  const result = await Effect.runPromise(verifyGoogleIdToken(await sign(), "test-client", keys));
  expect(result.identity.subject).toBe("google-subject");
  expect(result.identity.emailAuthoritative).toBe(true);
  expect(result.nonce).toBe("browser-nonce");
});
it.each([
  { iss: "https://attacker.test" },
  { aud: "another-client" },
  { azp: "another-client" },
  { exp: 1 },
  { email_verified: false },
  { nonce: undefined },
  { sub: undefined },
  { exp: undefined },
])("rejects invalid claims %j", async (claims) => {
  const error = await Effect.runPromise(
    verifyGoogleIdToken(await sign(claims), "test-client", keys).pipe(Effect.flip),
  );
  expect(error.code).toBe("GOOGLE_IDENTITY_INVALID");
});
it("rejects a signature from an untrusted key", async () => {
  const other = await generateKeyPair("RS256");
  const error = await Effect.runPromise(
    verifyGoogleIdToken(await sign({}, other.privateKey), "test-client", keys).pipe(Effect.flip),
  );
  expect(error.code).toBe("GOOGLE_IDENTITY_INVALID");
});
it("requires Namera email proof for third-party emails but accepts Workspace ownership", async () => {
  const external = await Effect.runPromise(
    verifyGoogleIdToken(await sign({ email: "alice@example.com" }), "test-client", keys),
  );
  expect(external.identity.emailAuthoritative).toBe(false);
  const workspace = await Effect.runPromise(
    verifyGoogleIdToken(
      await sign({ email: "alice@example.com", hd: "example.com" }),
      "test-client",
      keys,
    ),
  );
  expect(workspace.identity.emailAuthoritative).toBe(true);
});
