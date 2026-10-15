import { Effect } from "effect";
import { HttpApiError } from "effect/http-api";

import type { ActorId, OrganizationId } from "@namera-ai/protocol";
import type { CurrentActorResponse } from "@namera-ai/protocol/dto";
import type { ApiKeyPermission, MemberPermission, OAuthScope } from "@namera-ai/protocol/model";

type ActorType = CurrentActorResponse["type"];
type ActorOfType<Type extends ActorType> = Extract<CurrentActorResponse, { readonly type: Type }>;

export type ActorPermissionRequirements = {
  readonly user: readonly MemberPermission[];
  readonly "api-key": readonly ApiKeyPermission[];
  readonly cli: readonly OAuthScope[];
  readonly mcp: readonly OAuthScope[];
};

type SupportedActorType = keyof ActorPermissionRequirements & ActorType;

export type ActorData<AllowedActor extends SupportedActorType> = ActorOfType<AllowedActor>["data"];

export type ActorReadScope = {
  readonly organizationId: OrganizationId;
  readonly actorId?: ActorId;
};

export type EnforceActorProps<AllowedActor extends SupportedActorType> = {
  actor: CurrentActorResponse;
  allowedActors: readonly AllowedActor[];
  requiredPermissions?: Pick<ActorPermissionRequirements, AllowedActor>;
};

type AnyEnforceActorProps = EnforceActorProps<SupportedActorType>;

const hasRequiredPermissions = <Permission extends string>(
  grantedPermissions: readonly Permission[],
  requiredPermissions: readonly Permission[] = [],
) => requiredPermissions.every((permission) => grantedPermissions.includes(permission));

const isAllowedActor = <AllowedActor extends SupportedActorType>(
  actor: CurrentActorResponse,
  allowedActors: readonly AllowedActor[],
): actor is ActorOfType<AllowedActor> =>
  allowedActors.some((allowedActor) => allowedActor === actor.type);

const enforceActorEffect = Effect.fn("server.enforceActor")(function* (
  props: AnyEnforceActorProps,
): Effect.fn.Return<ActorData<SupportedActorType>, HttpApiError.Forbidden> {
  const { actor, allowedActors, requiredPermissions } = props;

  if (!isAllowedActor(actor, allowedActors)) {
    return yield* new HttpApiError.Forbidden();
  }

  switch (actor.type) {
    case "user": {
      if (!hasRequiredPermissions(actor.data.role.permissions, requiredPermissions?.user)) {
        return yield* new HttpApiError.Forbidden();
      }

      return actor.data;
    }
    case "api-key":
      if (
        !hasRequiredPermissions(actor.data.apiKey.permissions, requiredPermissions?.["api-key"])
      ) {
        return yield* new HttpApiError.Forbidden();
      }
      return actor.data;
    case "cli":
    case "mcp":
      if (
        !hasRequiredPermissions(actor.data.authorization.scopes, requiredPermissions?.[actor.type])
      ) {
        return yield* new HttpApiError.Forbidden();
      }
      return actor.data;
  }
});

export function enforceActor<const AllowedActor extends SupportedActorType>(
  props: EnforceActorProps<AllowedActor>,
): Effect.Effect<ActorData<AllowedActor>, HttpApiError.Forbidden>;
export function enforceActor(
  props: AnyEnforceActorProps,
): Effect.Effect<ActorData<SupportedActorType>, HttpApiError.Forbidden> {
  return enforceActorEffect(props);
}

export const enforceWalletOwner = Effect.fnUntraced(function* (actor: CurrentActorResponse) {
  const user = yield* enforceActor({
    actor,
    allowedActors: ["user"],
    requiredPermissions: { user: ["wallet:update"] },
  });

  if (user.role.type !== "system" || user.role.key !== "owner") {
    return yield* new HttpApiError.Forbidden();
  }

  return user;
});

export const toActorReadScope = (
  data: ActorData<"user" | "api-key" | "cli" | "mcp">,
  permission?: "wallet:read" | "session-key:read",
): ActorReadScope =>
  // Management read permissions widen only the named resource. Execution reads
  // omit this permission and retain their existing actor/grant scope.
  "organization" in data ||
  ("apiKey" in data && permission !== undefined && data.apiKey.permissions.includes(permission))
    ? { organizationId: "organization" in data ? data.organization.id : data.organizationId }
    : { organizationId: data.organizationId, actorId: data.actorId };

export const enforceManagementActor = Effect.fnUntraced(function* (
  actor: CurrentActorResponse,
  permission?: ApiKeyPermission,
) {
  const memberPermission =
    permission === "session-key:install"
      ? "session-key:create"
      : permission === "session-key:uninstall"
        ? "session-key:revoke"
        : permission;
  const data = yield* enforceActor({
    actor,
    allowedActors: ["user", "api-key"],
    requiredPermissions: {
      user: memberPermission === undefined ? [] : [memberPermission],
      "api-key": permission === undefined ? [] : [permission],
    },
  });
  const permissions: readonly string[] =
    "role" in data ? data.role.permissions : data.apiKey.permissions;
  const allowedKinds: Array<"install" | "uninstall"> = [];
  if (permissions.includes(actor.type === "user" ? "session-key:create" : "session-key:install"))
    allowedKinds.push("install");
  if (permissions.includes(actor.type === "user" ? "session-key:revoke" : "session-key:uninstall"))
    allowedKinds.push("uninstall");
  return {
    actorId: data.actorId,
    organizationId: "organization" in data ? data.organization.id : data.organizationId,
    allowedKinds,
  };
});
