import { DateTime, Effect, Schema } from "effect";

import { Email, GoogleAuthError } from "@namera-ai/protocol";
import { jwtVerify, type JWTVerifyGetKey } from "jose";

const GoogleClaims = Schema.Struct({
  sub: Schema.NonEmptyString,
  email: Email,
  email_verified: Schema.Literal(true),
  nonce: Schema.NonEmptyString,
  azp: Schema.optionalKey(Schema.String),
  hd: Schema.optionalKey(Schema.NonEmptyString),
  name: Schema.optionalKey(Schema.NonEmptyString),
  picture: Schema.optionalKey(Schema.String.check(Schema.isPattern(/^https:\/\//))),
});

export const verifyGoogleIdToken = Effect.fnUntraced(function* (
  token: string,
  clientId: string,
  keys: JWTVerifyGetKey,
) {
  const now = yield* DateTime.now;
  const verified = yield* Effect.tryPromise({
    try: () =>
      jwtVerify(token, keys, {
        algorithms: ["RS256"],
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        audience: clientId,
        requiredClaims: ["exp", "iat", "sub"],
        currentDate: DateTime.toDate(now),
      }),
    catch: () => new GoogleAuthError({ code: "GOOGLE_IDENTITY_INVALID" }),
  });
  const claims = yield* Schema.decodeUnknownEffect(GoogleClaims)(verified.payload).pipe(
    Effect.mapError(() => new GoogleAuthError({ code: "GOOGLE_IDENTITY_INVALID" })),
  );
  if (claims.azp !== undefined && claims.azp !== clientId)
    return yield* new GoogleAuthError({ code: "GOOGLE_IDENTITY_INVALID" });
  return {
    identity: {
      subject: claims.sub,
      email: claims.email,
      emailAuthoritative: claims.email.endsWith("@gmail.com") || claims.hd !== undefined,
      ...(claims.name ? { name: claims.name } : {}),
      ...(claims.picture ? { image: claims.picture } : {}),
    },
    nonce: claims.nonce,
  };
});
