import { Schema } from "effect";

export const EventSource = Schema.Literals(["dashboard"]);
export const TargetType = Schema.String;

export type EventSource = typeof EventSource.Type;
export type TargetType = typeof TargetType.Type;
