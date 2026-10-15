import { afterEach, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { HeroCta } from "../../src/components/marketing/hero-cta";

import "../../src/styles/index.css";

vi.mock("@namera-ai/telemetry/analytics/browser", () => ({
  captureAnalytics: vi.fn(),
  analyticsDisabled: () => true,
}));

afterEach(() => vi.restoreAllMocks());

it("prevents repeat submission while pending and preserves the email for a failed retry", async () => {
  let finish!: (response: Response) => void;
  const response = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  const fetch = vi.spyOn(globalThis, "fetch").mockReturnValue(response);
  const screen = await render(<HeroCta />);
  try {
    await page.getByLabelText("Email address").fill("person@example.com");
    await page.getByRole("button", { name: "Notify me at launch" }).click();
    await expect.poll(() => fetch.mock.calls.length).toBe(1);
    await expect.element(page.getByRole("button", { name: "Joining..." })).toBeDisabled();
    await expect.element(page.getByLabelText("Email address")).toBeDisabled();
    const form = document.querySelector("form");
    if (!form) throw new Error("Waitlist form missing");
    form.requestSubmit();
    await expect.element(page.getByRole("button", { name: "Joining..." })).toBeDisabled();
    expect(fetch).toHaveBeenCalledOnce();

    finish(new Response(null, { status: 429 }));
    await expect.element(page.getByRole("button", { name: "Notify me at launch" })).toBeEnabled();
    await expect.element(page.getByLabelText("Email address")).toHaveValue("person@example.com");
    await expect
      .element(page.getByText("Too many attempts. Please try again later."))
      .toBeVisible();

    fetch.mockResolvedValue(
      new Response(JSON.stringify({ accepted: true }), {
        headers: { "content-type": "application/json" },
      }),
    );
    await page.getByRole("button", { name: "Notify me at launch" }).click();
    await expect
      .element(
        page.getByText(
          "You are on the list. We will write to person@example.com the day Namera opens.",
        ),
      )
      .toBeVisible();
    expect(fetch).toHaveBeenCalledTimes(2);
    for (const [url, init] of fetch.mock.calls) {
      expect(new URL(String(url)).pathname).toBe("/waitlist");
      expect(init?.credentials).toBe("omit");
      expect(JSON.parse(String(init?.body))).toEqual({ email: "person@example.com" });
    }
  } finally {
    finish(new Response(null, { status: 500 }));
    await screen.unmount();
  }
});
