import { Effect } from "effect";
import { HttpApiError } from "effect/unstable/httpapi";

import type { CurrentActorResponse } from "@namera-ai/protocol/dto";
import type { MemberPermission } from "@namera-ai/protocol/model";

type ActorType = CurrentActorResponse["type"];
type ActorOfType<Type extends ActorType> = Extract<CurrentActorResponse, { readonly type: Type }>;

export type ActorPermissionRequirements = {
  readonly user: readonly MemberPermission[];
  readonly "api-key": readonly never[];
};

type SupportedActorType = keyof ActorPermissionRequirements & ActorType;

export type ActorData<AllowedActor extends SupportedActorType> = ActorOfType<AllowedActor>["data"];

export type EnforceActorProps<AllowedActor extends SupportedActorType> = {
  actor: CurrentActorResponse;
  allowedActors: readonly AllowedActor[];
  requiredPermissions?: Pick<ActorPermissionRequirements, AllowedActor>;
};

type AnyEnforceActorProps = EnforceActorProps<SupportedActorType>;

const hasRequiredPermissions = (
  grantedPermissions: readonly MemberPermission[],
  requiredPermissions: readonly MemberPermission[] = [],
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
