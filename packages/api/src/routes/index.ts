import { HttpApi, OpenApi } from "effect/unstable/httpapi";

import {
  authCoreGroup,
  organizationGroup,
  magicLinkGroup,
  userGroup,
} from "./auth";
import { userPreferencesGroup } from "./core";
import { healthGroup } from "./health";
import { rpcGroup } from "./rpc";
import { telemetryGroup } from "./telemetry";

export const api = HttpApi.make("NameraAPI")
  .add(userPreferencesGroup)
  .add(organizationGroup)
  .add(authCoreGroup)
  .add(magicLinkGroup)
  .add(userGroup)
  .add(rpcGroup)
  .add(telemetryGroup)
  .add(healthGroup)
  .annotate(OpenApi.Title, "Namera API")
  .annotate(
    OpenApi.Description,
    "Backend API for Namera built using Effect and Drizzle",
  )
  .annotate(
    OpenApi.Summary,
    "Namera is a programmable wallet infrastructure that lets agents execute onchain transactions within rules you define. Instead of giving full wallet access, you define permissions upfront and let agents operate within those boundaries.",
  )
  .annotate(OpenApi.Servers, [
    {
      url: "http://localhost:8080",
      description: "Development server",
    },
    {
      url: "https://api.namera.ai",
      description: "Production server",
    },
  ])
  .annotate(OpenApi.License, {
    name: "Apache-2.0",
    url: "https://opensource.org/licenses/Apache-2.0",
  });
