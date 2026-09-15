import { ConfigProvider } from "effect";

const testSecret = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

export const makeTestConfigLayer = (overrides: Record<string, string> = {}) =>
  ConfigProvider.layer(
    ConfigProvider.fromEnv({
      env: {
        AUTH_INVITE_REQUIRED: "false",
        AUTH_API_PUBLIC_ORIGIN: "http://api.test",
        AUTH_DASHBOARD_PUBLIC_ORIGIN: "http://dashboard.test",
        CRYPTO_HMAC_KEY: testSecret,
        CRYPTO_ENCRYPTION_KEY: testSecret,
        ...overrides,
      },
    }),
  );
export const TestConfigLayer = makeTestConfigLayer();
