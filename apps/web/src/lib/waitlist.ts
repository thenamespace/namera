import { Schema } from "effect";

import { JoinWaitlistRequest, JoinWaitlistResponse } from "@namera-ai/protocol/dto";

export class WaitlistRequestError extends Error {
  constructor(readonly status: number) {
    super(
      status === 429
        ? "Too many attempts. Please try again later."
        : "Could not join the waitlist. Please try again.",
    );
  }
}

export async function joinWaitlist(
  payload: typeof JoinWaitlistRequest.Type,
  apiUrl: string,
  fetcher = globalThis.fetch,
) {
  const body = Schema.encodeSync(JoinWaitlistRequest)(payload);
  const response = await fetcher(new URL("/waitlist", apiUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "omit",
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new WaitlistRequestError(response.status);
  return Schema.decodeUnknownSync(JoinWaitlistResponse)(await response.json());
}
