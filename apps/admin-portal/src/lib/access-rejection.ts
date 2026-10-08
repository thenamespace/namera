import { Predicate } from "effect";

export const isAccessRejection = (error: unknown) =>
  Predicate.isTagged(error, "Unauthorized") ||
  Predicate.isTagged(error, "Forbidden") ||
  (Predicate.isTagged(error, "PlatformAuthError") &&
    "code" in error &&
    error.code === "ADMIN_ACCESS_REQUIRED");
