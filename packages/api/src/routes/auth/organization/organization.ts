import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";

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
    }).annotate(OpenApi.Summary, "Create an organization"),
    HttpApiEndpoint.get("list", "/list-user-organizations", {
      success: ListUserOrganizationsResponse,
      error: [OrganizationError, ...CommonErrors],
    }).annotate(OpenApi.Summary, "List organizations for the current user"),
    HttpApiEndpoint.post("setActive", "/set-active-organization", {
      payload: SetActiveOrganizationRequest,
      error: [OrganizationError, ...CommonErrors],
      success: SetActiveOrganizationResponse,
    }).annotate(OpenApi.Summary, "Set the session's active organization"),
    HttpApiEndpoint.get("getOrganization", "/get-organization", {
      query: GetOrganizationRequest,
      error: [OrganizationError, ...CommonErrors],
      success: GetOrganizationResponse,
    }).annotate(OpenApi.Summary, "Get an organization"),
    HttpApiEndpoint.post("update", "/update-organization", {
      payload: UpdateOrganizationRequest,
      error: [OrganizationError, ...CommonErrors],
      success: UpdateOrganizationResponse,
    }).annotate(OpenApi.Summary, "Update the active organization"),
  )
  .annotate(OpenApi.Description, "Organization lifecycle and selection")
  .middleware(Authorization)
  .prefix("/auth/organization") {}
