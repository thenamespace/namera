import { Schema } from "effect";

import { MetadataIcon } from "@namera-ai/schema";

export const WorkspaceUpdateRequest = Schema.Struct({
  metadata: Schema.Struct({
    name: Schema.String,
    logo: MetadataIcon,
  }),
  slug: Schema.String.check(
    Schema.isPattern(/^[a-z0-9][a-z0-9-]{2,62}[a-z0-9]$/, {
      message: "Invalid slug",
    }),
    Schema.isLengthBetween(3, 63, {
      message: "Slug must be between 3 and 63 characters",
    }),
  ),
});

export type WorkspaceUpdateRequest = typeof WorkspaceUpdateRequest.Type;
