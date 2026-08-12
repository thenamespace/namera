import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";

import { OrganizationErrors, OrganizationMemberErrors } from "@namera-ai/protocol";
import {
  ListOrganizationMemberResponse,
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
