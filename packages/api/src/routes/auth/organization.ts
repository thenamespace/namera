import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { InternalError } from "@namera-ai/schema";
import {
  CreateOrganizationRequest,
  CreateOrganizationResponse,
  GetOrganizationRequest,
  GetOrganizationResponse,
  ListUserOrganizationsResponse,
  OrganizationError,
  SetActiveOrganizationRequest,
  SetActiveOrganizationResponse,
  UpdateOrganizationRequest,
  UpdateOrganizationResponse,
} from "@namera-ai/schema/dto";

import { Authorization } from "../../middlewares";

export const organizationGroup = HttpApiGroup.make("organization")
  .add(
    HttpApiEndpoint.post("create", "/organization/create", {
      payload: CreateOrganizationRequest,
      error: [OrganizationError, InternalError],
      success: CreateOrganizationResponse,
    }),
    HttpApiEndpoint.get("list", "/organization/list", {
      success: ListUserOrganizationsResponse,
      error: [OrganizationError, InternalError],
    }),
    HttpApiEndpoint.post("setActive", "/organization/set-active", {
      payload: SetActiveOrganizationRequest,
      error: [OrganizationError, InternalError],
      success: SetActiveOrganizationResponse,
    }),
    HttpApiEndpoint.get("getOrganization", "/organization/get", {
      params: GetOrganizationRequest,
      error: [OrganizationError, InternalError],
      success: GetOrganizationResponse,
    }),
    HttpApiEndpoint.post("update", "/organization/update", {
      payload: UpdateOrganizationRequest,
      error: [OrganizationError, InternalError],
      success: UpdateOrganizationResponse,
    }),
  )
  .middleware(Authorization)
  .prefix("/auth");
