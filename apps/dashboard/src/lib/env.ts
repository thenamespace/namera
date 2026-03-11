import { ConfigProvider } from "effect";

export const EnvLive = ConfigProvider.fromJson(import.meta.env);
