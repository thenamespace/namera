---
"@namera-ai/sdk": major
---

Namera v2: a rewrite on viem and Effect, with no compatibility with 1.x.

- Two mirrored entries: the Promise API (`@namera-ai/sdk`) and the Effect API (`@namera-ai/sdk/effect`), with every
  module also importable on its own.
- Errors are one class per failure family with a tagged `reason`, carrying viem's error fields. `ChainError`
  (`Transport`, `Rpc`, `Reverted`, `Timeout`) is the first family; raw viem and ox errors become a `ChainError` with
  the original as the cause. `NameraError` holds the union, a guard that works across duplicate copies, and `decode`.
- `Session.now()` returns the current time in the seconds sessions use; the Effect form reads `Clock`.
