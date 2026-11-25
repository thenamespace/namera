---
"@namera-ai/sdk": minor
---

`NameraError.toJSON(error)` and `NameraError.fromJSON(json)` send errors across process boundaries: plain, versioned
JSON (`format: 1`) with the family and reason tags and fields, a `{ name, message }` summary of the cause and viem's
error fields, never keys, signatures or URLs with credentials; read back as the same family and reason classes, so
`instanceof`, the guards and `Effect.catchReason` work on the other side. Input that isn't a serialized error fails with
the new `SerializationError` (`Malformed`, `VersionUnsupported`), which joins the `NameraError` union.
