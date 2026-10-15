import type { SessionKeyResponse } from "@namera-ai/protocol/dto";

export const sessionKeyCreatorPresentation = (creator: SessionKeyResponse["creator"]) =>
  "user" in creator
    ? { metadata: creator.user.metadata, fallbackName: creator.user.email }
    : { metadata: creator.metadata, fallbackName: "API key" };

export const sessionKeyCreatorName = (creator: SessionKeyResponse["creator"]) => {
  const { metadata, fallbackName } = sessionKeyCreatorPresentation(creator);
  return metadata.name ?? fallbackName;
};
