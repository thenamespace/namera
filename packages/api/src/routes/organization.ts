import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { Authorization } from "@/middlewares";
import {
  CheckOrganizationSlugRequest,
  CheckOrganizationSlugResponse,
  CreateOrganizationRequest,
  CreateOrganizationResponse,
  DeleteOrganizationRequest,
  DeleteOrganizationResponse,
  GetFullOrganizationRequest,
  GetFullOrganizationResponse,
  ListOrganizationsRequest,
  ListOrganizationsResponse,
  OrganizationError,
  SetActiveOrganizationRequest,
  SetActiveOrganizationResponse,
  UpdateOrganizationRequest,
  UpdateOrganizationResponse,
} from "@namera-ai/schema";

export const organizationGroup = HttpApiGroup.make("organization")
  .add(
    // Create Organization
    HttpApiEndpoint.post("create", "/organization/create", {
      payload: CreateOrganizationRequest,
      error: OrganizationError,
      success: CreateOrganizationResponse,
    }),
    // Check if slug is available
    HttpApiEndpoint.post("checkSlug", "/organization/check-slug", {
      payload: CheckOrganizationSlugRequest,
      error: OrganizationError,
      success: CheckOrganizationSlugResponse,
    }),
    // List user's organizations
    HttpApiEndpoint.get("list", "/organization/list", {
      params: ListOrganizationsRequest,
      success: ListOrganizationsResponse,
      error: OrganizationError,
    }),
    // Set current user's active organization
    HttpApiEndpoint.post("setActive", "/organization/set-active", {
      payload: SetActiveOrganizationRequest,
      error: OrganizationError,
      success: SetActiveOrganizationResponse,
    }),
    // Get Organization
    HttpApiEndpoint.get(
      "getFullOrganization",
      "/organization/get-full-organization",
      {
        params: GetFullOrganizationRequest,
        error: OrganizationError,
        success: GetFullOrganizationResponse,
      },
    ),
    // Update Organization
    HttpApiEndpoint.post("update", "/organization/update", {
      payload: UpdateOrganizationRequest,
      error: OrganizationError,
      success: UpdateOrganizationResponse,
    }),
    // Delete Organization
    HttpApiEndpoint.post("delete", "/organization/delete", {
      payload: DeleteOrganizationRequest,
      error: OrganizationError,
      success: DeleteOrganizationResponse,
    }),
  )
  .middleware(Authorization)
  .prefix("/auth");
