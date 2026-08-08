import { Schema } from "effect";

export const ApplicationRelativePath = Schema.String.check(
  Schema.isPattern(/^\/(?!\/)[^\s\\]*$/, {
    message: "Path must be application-relative",
  }),
  Schema.isMaxLength(2048, {
    message: "Path is too long",
  }),
);

export type ApplicationRelativePath = typeof ApplicationRelativePath.Type;
