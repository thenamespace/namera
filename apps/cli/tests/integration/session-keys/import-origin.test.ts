import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "namera-import-origin-"));
  vi.stubEnv("XDG_CONFIG_HOME", directory);
  vi.stubEnv("NAMERA_API_URL", "");
  vi.resetModules();
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true });
});

describe("offline session import origin", () => {
  it("uses production before the first login", async () => {
    const { sessionKeyImportOrigin } =
      await import("../../../src/services/session-keystore/import-origin.js");
    expect(await sessionKeyImportOrigin("personal")).toBe("https://api.namera.ai");
  });

  it("uses an explicit host without a saved profile, ahead of the environment", async () => {
    vi.stubEnv("NAMERA_API_URL", "https://api.namera.ai");
    const { sessionKeyImportOrigin } =
      await import("../../../src/services/session-keystore/import-origin.js");
    expect(await sessionKeyImportOrigin("dev", "http://localhost:8080/")).toBe(
      "http://localhost:8080",
    );
  });

  it("preserves environment and saved-profile origins without reading credentials", async () => {
    const { saveProfile } = await import("../../../src/services/config.js");
    await saveProfile("dev", { baseUrl: "http://localhost:8080" });
    const { sessionKeyImportOrigin } =
      await import("../../../src/services/session-keystore/import-origin.js");
    expect(await sessionKeyImportOrigin("dev")).toBe("http://localhost:8080");
    vi.stubEnv("NAMERA_API_URL", "https://api.namera.ai");
    expect(await sessionKeyImportOrigin("dev")).toBe("https://api.namera.ai");
  });

  it("does not silently substitute production for an unknown named profile", async () => {
    const { sessionKeyImportOrigin } =
      await import("../../../src/services/session-keystore/import-origin.js");
    await expect(sessionKeyImportOrigin("dev")).rejects.toMatchObject({
      code: "PROFILE_REQUIRED",
      nextStep: expect.stringContaining("--host"),
    });
  });
});
