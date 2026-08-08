import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";

import { OrganizationError } from "@namera-ai/protocol";
import { ListOrganizationMemberResponse } from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { Authorization } from "#/middlewares/index";

export class MemberGroup extends HttpApiGroup.make("member")
  .add(
    HttpApiEndpoint.get("listOrgMembers", "/list-org-members", {
      error: [OrganizationError, ...CommonErrors],
      success: ListOrganizationMemberResponse,
    }).annotate(OpenApi.Summary, "List active organization members"),
  )
  .annotate(OpenApi.Description, "Organization membership")
  .middleware(Authorization)
  .prefix("/auth/member") {}
