import { Flag } from "effect/unstable/cli";

export const profileFlag = Flag.string("profile").pipe(
  Flag.withDescription("CLI profile name"),
  Flag.withDefault("personal"),
);

export const jsonFlag = Flag.boolean("json").pipe(
  Flag.withDescription("Print stable machine-readable JSON"),
);
