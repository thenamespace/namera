import { ConfigProvider } from "effect";

const testSecret = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

export const TestConfigLayer = ConfigProvider.layer(
  ConfigProvider.fromUnknown({
    AUTH_API_PUBLIC_ORIGIN: "http://api.test",
    AUTH_DASHBOARD_PUBLIC_ORIGIN: "http://dashboard.test",
    CRYPTO_HMAC_KEY: testSecret,
    CRYPTO_ENCRYPTION_KEY: testSecret,
  }),
);
