export type AliasType = "account" | "session" | "keystore";

export type IdentifierOrAlias =
  | {
      identifier: string;
    }
  | {
      alias: string;
    };
