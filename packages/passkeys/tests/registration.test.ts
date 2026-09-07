import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";

import { Passkeys } from "../src/service.js";
import { registrationFixture } from "./registration-fixture.js";

const ceremony = {
  challenge: "test-registration-challenge",
  origin: "https://dashboard.example.com",
  rpId: "dashboard.example.com",
};

layer(Passkeys.layer)("live passkey registration", (it) => {
  it.effect("verifies a real P-256 self-attestation and returns exact public material", () =>
    Effect.gen(function* () {
      const passkeys = yield* Passkeys;
      const fixture = registrationFixture(ceremony);
      const result = yield* passkeys.verifyRegistration({
        response: fixture.response,
        expectedChallenge: ceremony.challenge,
        expectedOrigin: ceremony.origin,
        expectedRpId: ceremony.rpId,
      });
      expect(result).toEqual({
        credentialId: fixture.response.id,
        publicKeyHex: fixture.publicKeyHex,
        transports: ["internal"],
        signCount: 0,
        rpId: ceremony.rpId,
      });
    }),
  );

  for (const test of [
    { name: "wrong challenge", patch: { challenge: "another-challenge" } },
    { name: "wrong origin", patch: { origin: "https://attacker.example.com" } },
    { name: "wrong RP ID", patch: { rpId: "attacker.example.com" } },
    { name: "cross-origin ceremony without topOrigin", patch: { crossOrigin: true } },
    { name: "missing user verification", patch: { flags: 0x41 } },
    { name: "missing user presence", patch: { flags: 0x44 } },
    { name: "tampered attestation signature", patch: { tamperSignature: true } },
  ]) {
    it.effect(`rejects ${test.name}`, () =>
      Effect.gen(function* () {
        const passkeys = yield* Passkeys;
        const fixture = registrationFixture({ ...ceremony, ...test.patch });
        const error = yield* passkeys
          .verifyRegistration({
            response: fixture.response,
            expectedChallenge: ceremony.challenge,
            expectedOrigin: ceremony.origin,
            expectedRpId: ceremony.rpId,
          })
          .pipe(Effect.flip);
        expect(error).toMatchObject({ _tag: "PasskeyError", operation: "verify-registration" });
      }),
    );
  }
});
