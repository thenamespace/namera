import { HttpApi, OpenApi } from "effect/unstable/httpapi";

import {
  AddressMetadataGroup,
  ApiKeyGroup,
  BillingGroup,
  DashboardGroup,
  ExecutionGroup,
  EnsGroup,
  HealthGroup,
  InvitationGroup,
  MagicLinkGroup,
  MemberGroup,
  NotificationGroup,
  OAuthGroup,
  OrganizationGroup,
  PortfolioGroup,
  SessionKeyGroup,
  SessionGroup,
  SignatureGroup,
  UserGroup,
  WalletGroup,
} from "./routes/index.js";

export * from "./middlewares/index.js";

// This class is the transport contract shared by the server, OpenAPI output,
// dashboard atoms, and public SDK. Handlers and business logic deliberately
// live outside this package so every client is generated from the same schema.
export class NameraApi extends HttpApi.make("NameraAPI")
  .add(
    AddressMetadataGroup,
    ApiKeyGroup,
    BillingGroup,
    DashboardGroup,
    ExecutionGroup,
    EnsGroup,
    HealthGroup,
    InvitationGroup,
    MagicLinkGroup,
    MemberGroup,
    NotificationGroup,
    PortfolioGroup,
    OAuthGroup,
    OrganizationGroup,
    SessionKeyGroup,
    SessionGroup,
    SignatureGroup,
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
