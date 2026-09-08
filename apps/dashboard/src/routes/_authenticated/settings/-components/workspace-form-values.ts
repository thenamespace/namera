import type { GetOrganizationResponse, UpdateOrganizationRequest } from "@namera-ai/protocol/dto";
import type { MetadataIcon } from "@namera-ai/protocol/model";

export const defaultWorkspaceLogo: MetadataIcon = { type: "emoji", value: "🏢" };

// A controlled logo field must not introduce undefined into an optional-key DTO.
export const workspaceFormValues = (
  organization: Pick<GetOrganizationResponse, "metadata">,
): UpdateOrganizationRequest => ({
  metadata: {
    ...organization.metadata,
    logo: organization.metadata.logo ?? defaultWorkspaceLogo,
  },
});
