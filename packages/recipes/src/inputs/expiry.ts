import { DateTime, Option, Schema } from "effect";

export const RecipeExpiry = Schema.String.check(
  Schema.makeFilter((value) => {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value))
      return "Choose an expiry date.";

    const date = DateTime.make(value);
    return Option.isSome(date) &&
      DateTime.formatIso(date.value) === (value.includes(".") ? value : value.replace("Z", ".000Z"))
      ? undefined
      : "Choose a valid expiry date.";
  }),
);

export function recipeValidUntil(expiresAt: string, now: number): number {
  const validUntil = Math.floor(DateTime.toEpochMillis(DateTime.makeUnsafe(expiresAt)) / 1000);
  if (validUntil <= now) throw new Error("Choose an expiry date in the future.");

  return validUntil;
}
