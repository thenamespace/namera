import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  setPersonProperties: vi.fn(),
  set_config: vi.fn(),
  opt_out_capturing: vi.fn(),
  opt_in_capturing: vi.fn(),
  getActiveMatchingSurveys: vi.fn(),
  displaySurvey: vi.fn(),
}));
vi.mock("posthog-js", () => ({ posthog: sdk }));

describe("browser analytics lifecycle", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.stubGlobal("window", { addEventListener: vi.fn() });
    vi.stubGlobal("location", {
      hostname: "dashboard.namera.ai",
      origin: "https://dashboard.namera.ai",
    });
    vi.stubGlobal("document", { cookie: "", visibilityState: "visible" });
    vi.stubGlobal("navigator", { doNotTrack: "0" });
    vi.stubGlobal("localStorage", { getItem: vi.fn(() => null), setItem: vi.fn() });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("never initializes in development or on preview hosts", async () => {
    const analytics = await import("../../src/analytics/browser.js");
    analytics.initializeAnalytics({ key: "public-test-token", production: false, surface: "web" });
    vi.stubGlobal("location", { hostname: "preview.example.com" });
    analytics.initializeAnalytics({ key: "public-test-token", production: true, surface: "web" });
    expect(sdk.init).not.toHaveBeenCalled();
  });

  it("resets an old identity and replaces workspace context before capture", async () => {
    const analytics = await import("../../src/analytics/browser.js");
    analytics.initializeAnalytics({
      key: "public-test-token",
      production: true,
      surface: "dashboard",
    });
    analytics.analyticsIdentity("user-one", "workspace-one", "First person");
    analytics.analyticsIdentity("user-two", "workspace-two", "Second person");
    expect(sdk.reset).toHaveBeenCalledOnce();
    expect(sdk.identify).toHaveBeenLastCalledWith("user-two", { name: "Second person" });
    expect(analytics.analyticsContext()).toBe("user-two:workspace-two");
    const config = sdk.init.mock.calls[0]?.[1];
    const event = config.before_send({ event: "$pageview", properties: { token: "secret" } });
    expect(event.properties.workspace_id).toBe("workspace-two");
    expect(event.properties.token).toBeUndefined();
    analytics.analyticsIdentity();
    expect(sdk.reset).toHaveBeenCalledTimes(2);
    expect(
      config.before_send({ event: "$pageview", properties: {} }).properties.workspace_id,
    ).toBeUndefined();
  });

  it("honors privacy signals and never enables replay or autocapture", async () => {
    const analytics = await import("../../src/analytics/browser.js");
    vi.stubGlobal("navigator", { globalPrivacyControl: true });
    analytics.initializeAnalytics({
      key: "public-test-token",
      production: true,
      surface: "dashboard",
    });
    expect(sdk.init).not.toHaveBeenCalled();
    vi.stubGlobal("navigator", { doNotTrack: "0" });
    analytics.initializeAnalytics({
      key: "public-test-token",
      production: true,
      surface: "dashboard",
    });
    expect(sdk.init.mock.calls[0]?.[1]).toMatchObject({
      disable_session_recording: true,
      autocapture: false,
      capture_pageview: false,
    });
    analytics.analyticsPage("/settings/profile");
    analytics.analyticsPage("/settings/profile");
    expect(sdk.capture).toHaveBeenCalledOnce();
    analytics.setAnalyticsDisabled(true);
    analytics.captureAnalytics("dashboard_action_started");
    expect(sdk.capture).toHaveBeenCalledOnce();
    expect(sdk.opt_out_capturing).toHaveBeenCalledOnce();
  });
});
