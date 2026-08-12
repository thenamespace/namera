import { Schema } from "effect";

export const AuditEventSource = Schema.Literals([
  "dashboard",
  "api",
  "cli",
  "mcp",
  "system",
  "webhook",
]);

export const AuditEventCommon = Schema.Struct({
  source: AuditEventSource,
  correlationId: Schema.String,
  requestId: Schema.NullOr(Schema.String),
  traceId: Schema.NullOr(Schema.String),
  createdAt: Schema.DateTimeUtcFromDate,
});

export type AuditEventSource = typeof AuditEventSource.Type;
