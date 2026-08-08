import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { OrganizationError } from "@namera-ai/protocol";
import { ListOrganizationMemberResponse } from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { Authorization } from "#/middlewares/index";

export class MemberGroup extends HttpApiGroup.make("member")
  .add(
    HttpApiEndpoint.get("listOrgMembers", "/list-org-members", {
      error: [OrganizationError, ...CommonErrors],
      success: ListOrganizationMemberResponse,
    }),
  )
  .middleware(Authorization)
  .prefix("/auth/member") {}
