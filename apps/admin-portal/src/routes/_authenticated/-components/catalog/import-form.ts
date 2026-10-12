import { Schema } from "effect";

import { ImportCatalogRequest } from "@namera-ai/protocol/dto";

export const CatalogImportForm = Schema.Struct({
  file: Schema.File.check(
    Schema.makeFilter((file) => file.size > 0 && file.size <= 2 * 1024 * 1024, {
      message: "Choose a non-empty JSON file up to 2 MiB.",
    }),
  ),
});

export async function readCatalogFile(file: File) {
  Schema.decodeUnknownSync(CatalogImportForm)({ file });
  return Schema.decodeUnknownSync(ImportCatalogRequest, { onExcessProperty: "error" })(
    JSON.parse(await file.text()),
  );
}
