import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/http-api";

import { OrganizationErrors, OrganizationMemberErrors } from "@namera-ai/protocol";
import {
  ListAssignableOrganizationRolesResponse,
  ListOrganizationMemberResponse,
  ListOrganizationRolesResponse,
  RemoveOrganizationMemberRequest,
  RemoveOrganizationMemberResponse,
  UpdateOrganizationMemberRoleRequest,
  UpdateOrganizationMemberRoleResponse,
} from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { Authorization } from "#/middlewares/index";

export class MemberGroup extends HttpApiGroup.make("member")
  .add(
    HttpApiEndpoint.get("listOrgMembers", "/list-org-members", {
      error: [...OrganizationErrors, ...CommonErrors],
      success: ListOrganizationMemberResponse,
    }).annotate(OpenApi.Summary, "List active organization members"),
    HttpApiEndpoint.get("listOrgRoles", "/list-org-roles", {
      error: [...OrganizationErrors, ...CommonErrors],
      success: ListOrganizationRolesResponse,
    }).annotate(OpenApi.Summary, "List roles for the active organization"),
    HttpApiEndpoint.get("listAssignableRoles", "/list-assignable-roles", {
      error: [...OrganizationErrors, ...CommonErrors],
      success: ListAssignableOrganizationRolesResponse,
    }).annotate(OpenApi.Summary, "List roles assignable by the current member"),
    HttpApiEndpoint.post("updateMemberRole", "/update-member-role", {
      payload: UpdateOrganizationMemberRoleRequest,
      error: [...OrganizationMemberErrors, ...OrganizationErrors, ...CommonErrors],
      success: UpdateOrganizationMemberRoleResponse,
    }).annotate(OpenApi.Summary, "Update an organization member's role"),
    HttpApiEndpoint.post("removeMember", "/remove-member", {
      payload: RemoveOrganizationMemberRequest,
      error: [...OrganizationMemberErrors, ...OrganizationErrors, ...CommonErrors],
      success: RemoveOrganizationMemberResponse,
    }).annotate(OpenApi.Summary, "Remove an organization member"),
  )
  .annotate(OpenApi.Description, "Organization membership")
  .middleware(Authorization)
  .prefix("/auth/member") {}
