import { Schema, Struct } from "effect";

import { OrganizationRoleId } from "#/common/index";
import {
  CustomOrganizationRoleInsert,
  OrganizationRole,
  OrganizationRoleUpdate,
} from "#/model/index";

export const GetOrganizationRoleRequest = Schema.Struct({
  organizationRoleId: OrganizationRoleId,
});
const OrganizationRoleResponseFields = [
  "id",
  "key",
  "metadata",
  "type",
  "permissions",
  "systemRoleId",
] as const;

export const GetOrganizationRoleResponse = Schema.Union([
  OrganizationRole.members[0].mapFields(Struct.pick(OrganizationRoleResponseFields)),
  OrganizationRole.members[1].mapFields(Struct.pick(OrganizationRoleResponseFields)),
]);

export const CreateCustomOrganizationRoleRequest = CustomOrganizationRoleInsert.mapFields(
  Struct.omit(["organizationId"]),
);
export const CreateCustomOrganizationRoleResponse = GetOrganizationRoleResponse;

export const UpdateCustomOrganizationRoleRequest = OrganizationRoleUpdate;
export const UpdateCustomOrganizationRoleResponse = GetOrganizationRoleResponse;

export type GetOrganizationRoleRequest = typeof GetOrganizationRoleRequest.Type;
export type GetOrganizationRoleResponse = typeof GetOrganizationRoleResponse.Type;
export type CreateCustomOrganizationRoleRequest = typeof CreateCustomOrganizationRoleRequest.Type;
export type CreateCustomOrganizationRoleResponse = typeof CreateCustomOrganizationRoleResponse.Type;
export type UpdateCustomOrganizationRoleRequest = typeof UpdateCustomOrganizationRoleRequest.Type;
export type UpdateCustomOrganizationRoleResponse = typeof UpdateCustomOrganizationRoleResponse.Type;
