import { Schema } from "effect";

const Text = Schema.String.check(Schema.isMaxLength(4096));
export const profileFields = [
  { key: "name", record: "name", label: "Display name" },
  { key: "description", record: "description", label: "Description" },
  { key: "avatar", record: "avatar", label: "Avatar URL" },
  { key: "header", record: "header", label: "Banner URL" },
  { key: "url", record: "url", label: "Website" },
  { key: "twitter", record: "com.twitter", label: "X / Twitter" },
  { key: "github", record: "com.github", label: "GitHub" },
  { key: "telegram", record: "org.telegram", label: "Telegram" },
] as const;
export const ProfileSchema = Schema.Struct({
  name: Text,
  description: Text,
  avatar: Text,
  header: Text,
  url: Text,
  twitter: Text,
  github: Text,
  telegram: Text,
});
export type ProfileValues = typeof ProfileSchema.Type;
export function profileValues(texts: Readonly<Record<string, string>>): ProfileValues {
  return {
    name: texts.name ?? "",
    description: texts.description ?? "",
    avatar: texts.avatar ?? "",
    header: texts.header ?? "",
    url: texts.url ?? "",
    twitter: texts["com.twitter"] ?? "",
    github: texts["com.github"] ?? "",
    telegram: texts["org.telegram"] ?? "",
  };
}
