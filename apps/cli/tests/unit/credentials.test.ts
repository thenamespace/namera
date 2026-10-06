import { beforeEach, describe, expect, it, vi } from "vitest";

const keyring = vi.hoisted(() => ({
  getPassword: vi.fn(),
  setPassword: vi.fn(),
  deletePassword: vi.fn(),
}));
vi.mock("@napi-rs/keyring", () => ({
  Entry: class {
    getPassword = keyring.getPassword;
    setPassword = keyring.setPassword;
    deletePassword = keyring.deletePassword;
  },
}));

import {
  deleteCredentials,
  readCredentials,
  writeCredentials,
} from "../../src/services/credentials.js";

beforeEach(() => vi.resetAllMocks());

describe("credential failure feedback", () => {
  it("keeps logout idempotent for an absent credential", () => {
    keyring.getPassword.mockReturnValue(null);
    expect(readCredentials("test")).toBeUndefined();
    deleteCredentials("test");
    expect(keyring.deletePassword).not.toHaveBeenCalled();
  });
  it("does not claim logout succeeded when credential deletion fails", () => {
    keyring.getPassword.mockReturnValue("stored");
    keyring.deletePassword.mockImplementation(() => {
      throw new Error("native-secret-details");
    });
    expect(() => deleteCredentials("test")).toThrow(
      expect.objectContaining({ code: "KEYRING_UNAVAILABLE" }),
    );
  });
  it("translates native read and write failures", () => {
    keyring.getPassword.mockImplementation(() => {
      throw new Error("native-secret-details");
    });
    keyring.setPassword.mockImplementation(() => {
      throw new Error("native-secret-details");
    });
    expect(() => readCredentials("test")).toThrow(
      expect.objectContaining({ code: "KEYRING_UNAVAILABLE" }),
    );
    expect(() =>
      writeCredentials("test", {
        accessToken: "test",
        refreshToken: null,
        expiresAt: 0,
        scopes: [],
      }),
    ).toThrow(expect.objectContaining({ code: "KEYRING_UNAVAILABLE" }));
  });
});
