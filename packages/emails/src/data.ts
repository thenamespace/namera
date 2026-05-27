import type { EmailTemplateType } from "./types";

export const nameraSegments = [
  "changelog",
  "newsletter",
  "announcement",
] as const;
export type NameraSegmentId = (typeof nameraSegments)[number];
export const segmentIds: Record<NameraSegmentId, string> = {
  changelog: "9aeb1d7f-0389-4906-97b1-8170a85d02d4",
  newsletter: "40e3c693-6c34-4bbb-b5ad-69c0fef44f05",
  announcement: "0f30e386-ea09-4f69-9eaf-7b7bf3a30dae",
};

export const templates: Record<EmailTemplateType, string> = {
  "sign-in-with-magic-link": "",
};
