import { Context, Effect, Layer, Option } from "effect";

import { CryptoService } from "@namera-ai/crypto";
import { Repository } from "@namera-ai/database";
import type { DatabaseError } from "@namera-ai/protocol";
import type {
  AuditEventSource,
  OrganizationEvent,
  OrganizationEventInsert,
  UserEvent,
  UserEventInsert,
} from "@namera-ai/protocol/model";

type AuditFields = "correlationId" | "requestId" | "source" | "traceId";
type AuditInput<Event> = Event extends unknown ? Omit<Event, AuditFields> : never;

export type UserAuditInput = AuditInput<UserEventInsert>;
export type OrganizationAuditInput = AuditInput<OrganizationEventInsert>;

export interface AuditOptions {
  readonly correlationId?: string;
  readonly source?: AuditEventSource;
}

export interface AuditService {
  readonly user: (
    input: UserAuditInput,
    options?: AuditOptions,
  ) => Effect.Effect<UserEvent, DatabaseError>;
  readonly organization: (
    input: OrganizationAuditInput,
    options?: AuditOptions,
  ) => Effect.Effect<OrganizationEvent, DatabaseError>;
}

export class Audit extends Context.Service<Audit, AuditService>()("@namera-ai/application/Audit") {
  static readonly layer = Layer.effect(
    Audit,
    Effect.gen(function* () {
      const crypto = yield* CryptoService;
      const repository = yield* Repository;

      const fields = Effect.fn("Audit.fields")(function* (options?: AuditOptions) {
        const span = yield* Effect.option(Effect.currentSpan);
        return {
          source: options?.source ?? ("api" as const),
          correlationId: options?.correlationId ?? (yield* crypto.randomToken(18)),
          requestId: null,
          traceId: Option.getOrNull(Option.map(span, (current) => current.traceId)),
        };
      });

      return Audit.of({
        user: Effect.fn("Audit.user")(function* (input, options) {
          return yield* repository.audit.user.insert({
            ...input,
            ...(yield* fields(options)),
          } as UserEventInsert);
        }),
        organization: Effect.fn("Audit.organization")(function* (input, options) {
          return yield* repository.audit.organization.insert({
            ...input,
            ...(yield* fields(options)),
          } as OrganizationEventInsert);
        }),
      });
    }),
  );
}
