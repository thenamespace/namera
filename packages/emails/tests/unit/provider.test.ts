import { expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Fiber, Layer } from "effect";
import { TestClock } from "effect/testing";

import { Email } from "@namera-ai/protocol";
import { beforeEach, vi } from "vitest";

import { EmailService } from "../../src/layer.js";
import type { SendEmailProps } from "../../src/types.js";

const provider = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    emails = provider;
  },
}));

const Live = EmailService.layer.pipe(
  Layer.provide(
    ConfigProvider.layer(
      ConfigProvider.fromUnknown({
        RESEND_API_KEY: "synthetic-provider-token",
        EMAIL_FROM: "Namera <mail@example.test>",
        EMAIL_REPLY_TO: "support@example.test",
      }),
    ),
  ),
);
const recipient = Email.make("recipient@example.test");
const input: SendEmailProps = {
  type: "magic-link",
  to: recipient,
  idempotencyKey: "magic-link:fixture",
  variables: {
    code: "12345678",
    expiresInMinutes: 10,
    magicLinkUrl: "https://example.test/auth?token=synthetic",
  },
};

beforeEach(() => {
  provider.send.mockReset();
  provider.send.mockResolvedValue({ data: { id: "message-test" }, error: null });
});

it.effect("maps configured delivery and stable idempotency to the provider", () =>
  Effect.gen(function* () {
    const service = yield* EmailService;
    expect(yield* service.send(input)).toBe("message-test");
    expect(provider.send).toHaveBeenCalledOnce();
    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Namera <mail@example.test>",
        to: input.to,
        replyTo: "support@example.test",
        subject: "Sign in to Namera",
        react: expect.any(Object),
      }),
      { idempotencyKey: input.idempotencyKey },
    );
  }).pipe(Effect.provide(Live)),
);

it.effect("preserves explicit envelope overrides and recipient arrays", () =>
  Effect.gen(function* () {
    const service = yield* EmailService;
    const email = Email.make("other@example.test");
    const { idempotencyKey: _key, ...withoutIdempotency } = input;
    yield* service.send({
      ...withoutIdempotency,
      from: "Override <override@example.test>",
      subject: "Custom",
      to: [recipient, email],
      replyTo: [email],
      cc: [email],
      bcc: email,
      tags: [{ name: "workflow", value: "authentication" }],
    });
    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Override <override@example.test>",
        subject: "Custom",
        to: [input.to, email],
        replyTo: [email],
        cc: [email],
        bcc: email,
        tags: [{ name: "workflow", value: "authentication" }],
      }),
      undefined,
    );
  }).pipe(Effect.provide(Live)),
);

it.effect.each([
  {
    name: "provider rejection",
    response: { data: null, error: { name: "validation_error", message: "Rejected" } },
    reason: "PROVIDER_REJECTED",
  },
  {
    name: "empty provider ID",
    response: { data: { id: "" }, error: null },
    reason: "INVALID_RESPONSE",
  },
])("maps $name without retrying inside the adapter", ({ response, reason }) =>
  Effect.gen(function* () {
    provider.send.mockResolvedValue(response);
    expect(yield* (yield* EmailService).send(input).pipe(Effect.flip)).toMatchObject({
      _tag: "EmailError",
      reason,
    });
    expect(provider.send).toHaveBeenCalledOnce();
  }).pipe(Effect.provide(Live)),
);

it.effect("maps transport failure without sending a second time", () =>
  Effect.gen(function* () {
    provider.send.mockRejectedValue(new Error("connection closed"));
    expect(yield* (yield* EmailService).send(input).pipe(Effect.flip)).toMatchObject({
      _tag: "EmailError",
      reason: "REQUEST_FAILED",
    });
    expect(provider.send).toHaveBeenCalledOnce();
  }).pipe(Effect.provide(Live)),
);

it.effect("bounds a provider request with the Effect clock", () =>
  Effect.gen(function* () {
    provider.send.mockImplementation(() => new Promise(() => {}));
    const fiber = yield* (yield* EmailService).send(input).pipe(Effect.flip, Effect.forkChild);
    yield* TestClock.adjust("10 seconds");
    expect(yield* Fiber.join(fiber)).toMatchObject({
      _tag: "EmailError",
      reason: "REQUEST_FAILED",
    });
    expect(provider.send).toHaveBeenCalledOnce();
  }).pipe(Effect.provide(Live)),
);
