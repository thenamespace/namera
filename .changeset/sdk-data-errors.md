---
"@namera-ai/sdk": patch
---

Errors are `Data.TaggedError` classes instead of `Schema.TaggedError`: an app that narrows `NameraError` costs the type
checker about 2,500 instantiations instead of 24,000, and Effect's Schema runtime (about 15 KB gzip) leaves every bundle
that doesn't parse grants (`ChainError` alone: 24.5 → 5.4 KB). `_tag`, the reasons, `instanceof`, the `isX` guards,
`Effect.catchTag`/`catchReason`, viem's error fields and the messages are unchanged. Errors are no longer Schema values:
the reason unions (`ChainErrorReason`, `GrantErrorReason`, `PolicyViolationReason`, `AccountErrorReason`,
`BundlerErrorReason`, `PaymasterErrorReason`, `KeystoreErrorReason`, `SessionKeyErrorReason`) and `SessionError.Problem`,
`CompatError.Problem`, `AccountError.AccountRef` and `KeystoreError.StoreRef` are types only, `Schema.encode` no longer
takes an error (`JSON.stringify` keeps the same fields), constructors no longer validate their fields at run time,
`error.name` is the tag (`"ChainError"`) and `new SessionKeyError.NoSigners()` takes no argument.
