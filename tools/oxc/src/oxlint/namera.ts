import noEffectRun from "./namera/no-effect-run.ts"
import noForeignInternal from "./namera/no-foreign-internal.ts"

export default {
  meta: {
    name: "namera"
  },
  rules: {
    "no-effect-run": noEffectRun,
    "no-foreign-internal": noForeignInternal
  }
}
