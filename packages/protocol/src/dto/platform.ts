import { Schema, Struct } from "effect";

import { Email } from "#/common/index";
import {
  PlatformAssignableRole,
  PlatformInvitation,
  PlatformMember,
  PlatformMemberView,
  PlatformPermission,
} from "#/model/auth/platform";

export const PlatformMeResponse = Schema.Struct({
  member: PlatformMember,
  email: Email,
  permissions: Schema.Array(PlatformPermission),
});
export const PlatformMembersResponse = Schema.Array(PlatformMemberView);
export const PlatformInvitationResponse = PlatformInvitation.mapFields(Struct.omit(["tokenHash"]));
export const CreatePlatformInvitationRequest = Schema.Struct({
  email: Email,
  role: PlatformAssignableRole,
});
export const ChangePlatformRoleRequest = Schema.Struct({ role: PlatformAssignableRole });
export const ChangePlatformStatusRequest = Schema.Struct({
  status: Schema.Literals(["active", "suspended"]),
});
export const TransferPlatformOwnershipRequest = Schema.Struct({ memberId: Schema.String });
export const AcceptPlatformInvitationRequest = Schema.Struct({
  token: Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{43}$/)),
});
