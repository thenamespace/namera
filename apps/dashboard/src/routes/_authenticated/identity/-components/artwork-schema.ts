import { Schema } from "effect";

export const artworkTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const artworkLimit = 2 * 1024 * 1024;
const ImageFile = Schema.instanceOf(File).check(
  Schema.makeFilter((file) => artworkTypes.includes(file.type), {
    message: "Choose a PNG, JPEG, WebP or GIF image.",
  }),
  Schema.makeFilter((file) => file.size > 0 && file.size <= artworkLimit, {
    message: "Choose an image no larger than 2 MB.",
  }),
);

export const ArtworkSchema = Schema.Struct({
  avatar: Schema.NullOr(ImageFile),
  header: Schema.NullOr(ImageFile),
});
export type ArtworkDraft = typeof ArtworkSchema.Type;
export type ArtworkKind = keyof ArtworkDraft;

export class IdentityArtworkError extends Schema.TaggedError<IdentityArtworkError>()(
  "IdentityArtworkError",
  {
    code: Schema.Literals(["UPLOAD_FAILED", "APPROVAL_INVALID", "AUTHORIZATION_EXPIRED"]),
  },
) {}
