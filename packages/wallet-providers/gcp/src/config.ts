import { Config } from "effect";

export const GcpConfig = Config.all({
  projectId: Config.String("GCP_PROJECT_ID"),
  location: Config.String("GCP_KMS_LOCATION").pipe(Config.withDefault("global")),
  keyRing: Config.String("GCP_KMS_KEY_RING"),
});
