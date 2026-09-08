import type { GetUserResponse, UpdateUserRequest } from "@namera-ai/protocol/dto";
import type { MetadataIcon } from "@namera-ai/protocol/model";

export const defaultProfileImage: MetadataIcon = { type: "icon", value: "user", color: "#f7f8f8" };

// Controlled fields must not introduce explicit undefined into optional-key DTOs.
export const profileFormValues = (user: Pick<GetUserResponse, "metadata">): UpdateUserRequest => ({
  metadata: {
    ...user.metadata,
    name: user.metadata.name ?? "",
    image: user.metadata.image ?? defaultProfileImage,
  },
});
