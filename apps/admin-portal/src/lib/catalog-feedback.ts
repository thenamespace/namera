import { Predicate } from "effect";

import { teamErrorMessage } from "@/lib/team-feedback";

export function catalogErrorMessage(error: unknown): string {
  if (
    Predicate.isTagged(error, "CatalogImportError") &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return teamErrorMessage(error);
}
