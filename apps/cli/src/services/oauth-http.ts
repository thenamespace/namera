import { Schema } from "effect";

import { cliFailure } from "./error-feedback.js";

export class OAuthRequestError extends Error {
  constructor(readonly code: string) {
    super("OAuth request failed");
  }
}

const OAuthFailure = Schema.Struct({ error: Schema.NonEmptyString });

/** Token requests must never replay their body at a redirect destination. */
export const postOAuthForm = async <A>(
  url: string,
  body: URLSearchParams,
  schema: Schema.Decoder<A>,
): Promise<A> => {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      throw cliFailure("UPSTREAM_UNAVAILABLE");
    }
    const reader = response.body?.getReader();
    if (!reader) throw cliFailure("UPSTREAM_UNAVAILABLE");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        // Read sequentially and enforce the bound before buffering another chunk.
        // oxlint-disable-next-line no-await-in-loop
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 32 * 1024) throw cliFailure("UPSTREAM_UNAVAILABLE");
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
      reader.releaseLock();
    }
    const json: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!response.ok) {
      const failure = Schema.decodeUnknownSync(OAuthFailure)(json);
      throw new OAuthRequestError(failure.error);
    }
    return Schema.decodeUnknownSync(schema)(json);
  } catch (error) {
    if (error instanceof OAuthRequestError) throw error;
    // Never expose tokens, schema inputs or arbitrary upstream diagnostics.
    throw cliFailure("UPSTREAM_UNAVAILABLE");
  }
};
