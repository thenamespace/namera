import { Exit, Schema } from "effect";

import { getAddress, type Address } from "viem";
import { createSiweMessage } from "viem/siwe";

import { IdentityArtworkError, type ArtworkKind } from "./artwork-schema";

const metadataOrigin = "https://metadata.namespace.ninja";
const Nonce = Schema.Struct({
  nonce: Schema.String.check(Schema.isPattern(/^[a-zA-Z0-9]{8,}$/)),
  expiresAt: Schema.Number.check(Schema.isFinite()),
});
const Upload = Schema.Struct({
  avatarUrl: Schema.optionalKey(Schema.String),
  headerUrl: Schema.optionalKey(Schema.String),
  url: Schema.optionalKey(Schema.String),
});

async function request(path: string, init: RequestInit, signal: AbortSignal): Promise<unknown> {
  try {
    const response = await fetch(`${metadataOrigin}${path}`, {
      ...init,
      credentials: "omit",
      referrerPolicy: "no-referrer",
      redirect: "error",
      signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
    });
    if (!response.ok) throw new IdentityArtworkError({ code: "UPLOAD_FAILED" });
    return await response.json();
  } catch {
    // Never include a multipart body, SIWE signature, or provider payload in feedback/telemetry.
    throw new IdentityArtworkError({ code: "UPLOAD_FAILED" });
  }
}

/** Namespace Avatar 2.0's manual SIWE protocol, without its Node-oriented SDK bundle. */
export async function authorizeArtwork(
  kind: ArtworkKind,
  address: Address,
  origin: string,
  signal: AbortSignal,
) {
  const result = await request(
    "/auth/nonce",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, scope: kind }),
    },
    signal,
  );
  const decoded = Schema.decodeUnknownExit(Nonce)(result);
  if (Exit.isFailure(decoded)) throw new IdentityArtworkError({ code: "UPLOAD_FAILED" });
  const { nonce, expiresAt } = decoded.value;
  if (expiresAt <= Date.now()) throw new IdentityArtworkError({ code: "AUTHORIZATION_EXPIRED" });
  return {
    message: createSiweMessage({
      address: getAddress(address),
      domain: new URL(origin).host,
      uri: origin,
      version: "1",
      chainId: 1,
      nonce,
      issuedAt: new Date(),
      statement: "Authorize a metadata update",
    }),
    expiresAt,
  };
}

export async function uploadArtwork(
  kind: ArtworkKind,
  file: File,
  name: string,
  address: Address,
  message: string,
  signature: string,
  signal: AbortSignal,
) {
  const body = new FormData();
  body.append(kind, file);
  body.append("siweMessage", message);
  body.append("siweSignature", signature);
  body.append("address", address);
  const result = await request(
    `/profile/mainnet/${encodeURIComponent(name)}/${kind}`,
    { method: "POST", body },
    signal,
  );
  const decoded = Schema.decodeUnknownExit(Upload)(result);
  if (Exit.isFailure(decoded)) throw new IdentityArtworkError({ code: "UPLOAD_FAILED" });
  const url =
    (kind === "avatar" ? decoded.value.avatarUrl : decoded.value.headerUrl) || decoded.value.url;
  if (!url) throw new IdentityArtworkError({ code: "UPLOAD_FAILED" });
  return url;
}
