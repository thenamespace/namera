import { Schema } from "effect";

export const Permission = Schema.Literals([
  "org:read",
  "org:update",
  "org:delete",
]);

export type Permission = typeof Permission.Type;
