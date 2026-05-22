import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { Authorization } from "@/middlewares";
import {
  CreateOrganizationRequest,
  CreateOrganizationResponse,
  DatabaseError,
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
      error: [OrganizationError, DatabaseError],
      success: CreateOrganizationResponse,
    }),

    // List user's organizations
    HttpApiEndpoint.get("list", "/organization/list", {
      params: ListOrganizationsRequest,
      success: ListOrganizationsResponse,
      error: [OrganizationError, DatabaseError],
    }),
    // Set current user's active organization
    HttpApiEndpoint.post("setActive", "/organization/set-active", {
      payload: SetActiveOrganizationRequest,
      error: [OrganizationError, DatabaseError],
      success: SetActiveOrganizationResponse,
    }),
    // Get Organization
    HttpApiEndpoint.get(
      "getFullOrganization",
      "/organization/get-full-organization",
      {
        params: GetFullOrganizationRequest,
        error: [OrganizationError, DatabaseError],
        success: GetFullOrganizationResponse,
      },
    ),
    // Update Organization
    HttpApiEndpoint.post("update", "/organization/update", {
      payload: UpdateOrganizationRequest,
      error: [OrganizationError, DatabaseError],
      success: UpdateOrganizationResponse,
    }),
    // TODO: Add Delete Organization in future
    // HttpApiEndpoint.post("delete", "/organization/delete", {
    //   payload: DeleteOrganizationRequest,
    //   error: [OrganizationError, DatabaseError],
    //   success: DeleteOrganizationResponse,
    // }),
  )
  .middleware(Authorization)
  .prefix("/auth");
