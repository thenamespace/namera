export type AliasType = "account" | "session-key" | "keystore";

export type IdentifierOrAlias =
  | {
      identifier: string;
    }
  | {
      alias: string;
    };
