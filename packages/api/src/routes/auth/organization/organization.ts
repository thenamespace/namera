import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { OrganizationError } from "@namera-ai/protocol";
import {
  CreateOrganizationRequest,
  CreateOrganizationResponse,
  GetOrganizationRequest,
  GetOrganizationResponse,
  ListUserOrganizationsResponse,
  SetActiveOrganizationRequest,
  SetActiveOrganizationResponse,
  UpdateOrganizationRequest,
  UpdateOrganizationResponse,
} from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { Authorization } from "#/middlewares/index";

export class OrganizationGroup extends HttpApiGroup.make("organization")
  .add(
    HttpApiEndpoint.post("create", "/create-organization", {
      payload: CreateOrganizationRequest,
      error: [OrganizationError, ...CommonErrors],
      success: CreateOrganizationResponse,
    }),
    HttpApiEndpoint.get("list", "/list-user-organizations", {
      success: ListUserOrganizationsResponse,
      error: [OrganizationError, ...CommonErrors],
    }),
    HttpApiEndpoint.post("setActive", "/set-active-organization", {
      payload: SetActiveOrganizationRequest,
      error: [OrganizationError, ...CommonErrors],
      success: SetActiveOrganizationResponse,
    }),
    HttpApiEndpoint.get("getOrganization", "/get-organization", {
      query: GetOrganizationRequest,
      error: [OrganizationError, ...CommonErrors],
      success: GetOrganizationResponse,
    }),
    HttpApiEndpoint.post("update", "/update-organization", {
      payload: UpdateOrganizationRequest,
      error: [OrganizationError, ...CommonErrors],
      success: UpdateOrganizationResponse,
    }),
  )
  .middleware(Authorization)
  .prefix("/auth/organization") {}
