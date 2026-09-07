import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";

import { Passkeys } from "../../src/service.js";
import { authenticationFixture } from "../fixtures/authentication.js";

const challengeBytes = new Uint8Array(32).fill(173);
const ceremony = {
  challenge: Buffer.from(challengeBytes).toString("base64url"),
  origin: "https://dashboard.example.com",
  rpId: "dashboard.example.com",
};

layer(Passkeys.layer)("live wallet-owner authentication", (it) => {
  it.effect("uses exact operation bytes and only the requested owner credential", () =>
    Effect.gen(function* () {
      const passkeys = yield* Passkeys;
      const fixture = authenticationFixture(ceremony);
      const options = yield* passkeys.generateAuthenticationOptions({
        rpId: ceremony.rpId,
        credentialId: fixture.response.id,
        challenge: challengeBytes,
        timeoutMs: 60_000,
      });
      expect(options.challenge).toBe(ceremony.challenge);
      expect(options.userVerification).toBe("required");
      expect(options.allowCredentials).toEqual([{ id: fixture.response.id, type: "public-key" }]);
      const verified = yield* passkeys.verifyAuthentication({
        response: fixture.response,
        expectedChallenge: options.challenge,
        expectedOrigin: ceremony.origin,
        expectedRpId: ceremony.rpId,
        credentialId: fixture.response.id,
        publicKeyHex: fixture.publicKeyHex,
        signCount: 0,
      });
      expect(verified.signCount).toBe(1);
      expect(verified.credentialId).toBe(fixture.response.id);
      expect(verified.clientDataJSON).toBe(
        Buffer.from(fixture.response.response.clientDataJSON, "base64url").toString("utf8"),
      );
      expect(verified.signatureDerHex).toBe(
        `0x${Buffer.from(fixture.response.response.signature, "base64url").toString("hex")}`,
      );
    }),
  );

  for (const test of [
    { name: "another operation challenge", patch: { challenge: "another-operation" } },
    { name: "another origin", patch: { origin: "https://attacker.example.com" } },
    { name: "another RP", patch: { rpId: "attacker.example.com" } },
    { name: "cross-origin without topOrigin", patch: { crossOrigin: true } },
    { name: "missing user verification", patch: { flags: 1 } },
    { name: "missing user presence", patch: { flags: 4 } },
    { name: "registration used as authentication", patch: { type: "webauthn.create" } },
    { name: "invalid cryptographic signature", patch: { tamperSignature: true } },
  ])
    it.effect(`rejects ${test.name}`, () =>
      Effect.gen(function* () {
        const passkeys = yield* Passkeys;
        const fixture = authenticationFixture({ ...ceremony, ...test.patch });
        const error = yield* passkeys
          .verifyAuthentication({
            response: fixture.response,
            expectedChallenge: ceremony.challenge,
            expectedOrigin: ceremony.origin,
            expectedRpId: ceremony.rpId,
            credentialId: fixture.response.id,
            publicKeyHex: fixture.publicKeyHex,
            signCount: 0,
          })
          .pipe(Effect.flip);
        expect(error).toMatchObject({ _tag: "PasskeyError", operation: "verify-authentication" });
      }),
    );

  it.effect("rejects credential substitution and non-increasing authenticator counters", () =>
    Effect.gen(function* () {
      const passkeys = yield* Passkeys;
      const fixture = authenticationFixture(ceremony);
      const request = {
        response: fixture.response,
        expectedChallenge: ceremony.challenge,
        expectedOrigin: ceremony.origin,
        expectedRpId: ceremony.rpId,
        credentialId: fixture.response.id,
        publicKeyHex: fixture.publicKeyHex,
        signCount: 0,
      };
      for (const patch of [
        { credentialId: "other-credential" },
        { signCount: 1 },
        { signCount: 2 },
      ]) {
        const error = yield* passkeys
          .verifyAuthentication({ ...request, ...patch })
          .pipe(Effect.flip);
        expect(error.operation).toBe("verify-authentication");
      }
    }),
  );

  it.effect("accepts synced passkeys which consistently report a zero counter", () =>
    Effect.gen(function* () {
      const passkeys = yield* Passkeys;
      const fixture = authenticationFixture({ ...ceremony, counter: 0 });
      const verified = yield* passkeys.verifyAuthentication({
        response: fixture.response,
        expectedChallenge: ceremony.challenge,
        expectedOrigin: ceremony.origin,
        expectedRpId: ceremony.rpId,
        credentialId: fixture.response.id,
        publicKeyHex: fixture.publicKeyHex,
        signCount: 0,
      });
      expect(verified.signCount).toBe(0);
    }),
  );
});
