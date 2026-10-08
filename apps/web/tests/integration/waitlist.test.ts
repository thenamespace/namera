import { Schema } from "effect";

import { JoinWaitlistRequest } from "@namera-ai/protocol/dto";
import { describe, expect, it, vi } from "vitest";

import { joinWaitlist } from "../../src/lib/waitlist.js";

describe("public waitlist", () => {
  const payload = Schema.decodeUnknownSync(JoinWaitlistRequest)({ email: " Person@Example.com " });

  it("posts normalized email without credentials and accepts repeat submissions", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"accepted":true}'));
    await expect(joinWaitlist(payload, "https://api.example.com", fetcher)).resolves.toEqual({
      accepted: true,
    });
    expect(fetcher).toHaveBeenCalledWith(
      new URL("https://api.example.com/waitlist"),
      expect.objectContaining({
        method: "POST",
        credentials: "omit",
        body: '{"email":"person@example.com"}',
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  it.each([429, 500])("rejects HTTP %i without exposing the response body", async (status) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("private server details", { status }));
    await expect(joinWaitlist(payload, "http://localhost:8080", fetcher)).rejects.toMatchObject({
      status,
    });
  });

  it("does not show success for malformed responses or network failures", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"accepted":false}'));
    await expect(joinWaitlist(payload, "https://api.example.com", fetcher)).rejects.toBeDefined();
    fetcher.mockRejectedValue(new TypeError("Network unavailable"));
    await expect(joinWaitlist(payload, "https://api.example.com", fetcher)).rejects.toThrow(
      "Network unavailable",
    );
  });
});
