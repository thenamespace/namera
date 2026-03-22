import type { Schema } from "effect";

export type EntityType = "smart-account" | "session-key" | "keystore";

export const entityName: Record<EntityType, string> = {
  keystore: "Keystore",
  "session-key": "Session Key",
  "smart-account": "Smart Account",
};

export type Entity<TEntityType extends EntityType> = {
  path: string;
  content: string;
  alias: string;
  type: TEntityType;
};

export type DeepPaths<T> = {
  [K in keyof T & string]: T[K] extends Schema.Top
    ? K
    : // biome-ignore lint/suspicious/noExplicitAny: safe
      T[K] extends Record<string, any>
      ? `${K}.${DeepPaths<T[K]>}`
      : never;
}[keyof T & string];
