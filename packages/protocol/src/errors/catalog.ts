import { Schema } from "effect";

export class CatalogNotFoundError extends Schema.TaggedError<CatalogNotFoundError>()(
  "CatalogNotFoundError",
  { resource: Schema.Literals(["catalog", "entry", "interface"]), id: Schema.String },
  { httpApiStatus: 404 },
) {}

export class CatalogImportError extends Schema.TaggedError<CatalogImportError>()(
  "CatalogImportError",
  {
    collection: Schema.Literals(["catalog", "entries", "interfaces"]),
    id: Schema.String,
    field: Schema.String,
    message: Schema.String,
  },
  { httpApiStatus: 409 },
) {}
