import { HttpApi, OpenApi } from "effect/unstable/httpapi";

import {
  ApiKeyGroup,
  BillingGroup,
  HealthGroup,
  InvitationGroup,
  MagicLinkGroup,
  MemberGroup,
  NotificationGroup,
  OrganizationGroup,
  SessionKeyGroup,
  SessionGroup,
  UserGroup,
  WalletGroup,
} from "./routes/index.js";

export * from "./middlewares/index.js";

export class NameraApi extends HttpApi.make("NameraAPI")
  .add(
    ApiKeyGroup,
    BillingGroup,
    HealthGroup,
    InvitationGroup,
    MagicLinkGroup,
    MemberGroup,
    NotificationGroup,
    OrganizationGroup,
    SessionKeyGroup,
    SessionGroup,
    UserGroup,
    WalletGroup,
  )
  .annotate(OpenApi.Title, "Namera API")
  .annotate(OpenApi.Description, "Backend API for Namera built using Effect and Drizzle")
  .annotate(
    OpenApi.Summary,
    "Namera is a programmable wallet infrastructure that lets agents execute onchain transactions within rules you define. Instead of giving full wallet access, you define permissions upfront and let agents operate within those boundaries.",
  )
  .annotate(OpenApi.Servers, [
    {
      url: "http://0.0.0.0:8080",
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
  }) {}
