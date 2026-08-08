import { Schema, Struct } from "effect";

import { OrganizationRoleId } from "#/common/index";
import { OrganizationRole } from "#/model/index";

export const GetOrganizationRoleRequest = Schema.Struct({
  organizationRoleId: OrganizationRoleId,
});
export const GetOrganizationRoleResponse = OrganizationRole.mapFields(
  Struct.pick(["id", "key", "metadata", "type", "permissions"]),
);

export type GetOrganizationRoleRequest = typeof GetOrganizationRoleRequest.Type;
export type GetOrganizationRoleResponse = typeof GetOrganizationRoleResponse.Type;
