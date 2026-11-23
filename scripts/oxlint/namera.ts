import noEffectRun from "./rules/no-effect-run.ts"
import noForeignInternal from "./rules/no-foreign-internal.ts"

export default {
  meta: {
    name: "namera"
  },
  rules: {
    "no-effect-run": noEffectRun,
    "no-foreign-internal": noForeignInternal
  }
}
