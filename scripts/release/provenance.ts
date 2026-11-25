import { Array as Arr, Option, Schema, String as Str } from "effect"

/** npm's `/-/npm/v1/attestations/<name>@<version>` response. */
export const Attestations = Schema.Struct({
  attestations: Schema.Array(
    Schema.Struct({
      predicateType: Schema.String,
      bundle: Schema.Struct({
        dsseEnvelope: Schema.Struct({ payload: Schema.String })
      })
    })
  )
})

const Statement = Schema.Struct({
  subject: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      digest: Schema.Struct({ sha512: Schema.optionalKey(Schema.String) })
    })
  ),
  predicate: Schema.Struct({
    buildDefinition: Schema.Struct({
      externalParameters: Schema.Struct({
        workflow: Schema.Struct({ repository: Schema.String, path: Schema.String })
      })
    })
  })
})
const decodeStatement = Schema.decodeUnknownOption(Schema.fromJsonString(Statement))

export const slsaProvenance = "https://slsa.dev/provenance/v1"

/** The workflow file npm's trusted publisher accepts. */
export const releaseWorkflowPath = ".github/workflows/release.yml"

/**
 * Checks a package version's npm provenance: an SLSA attestation whose subject is this tarball
 * (sha512 of the published bytes, as hex) and that was built by the release workflow. The
 * signature itself is npm's to verify (`npm audit signatures`); this binds the attestation to the
 * archive the release verified. `repository` is the GitHub URL of the repository that releases.
 */
export const provenanceProblems = (
  attestations: typeof Attestations.Type,
  release: { readonly name: string; readonly version: string; readonly sha512Hex: string },
  repository: string
) => {
  const id = `${release.name}@${release.version}`
  const found = Arr.findFirst(
    attestations.attestations,
    (attestation) => attestation.predicateType === slsaProvenance
  )
  if (Option.isNone(found)) return [`${id}: no SLSA provenance attestation`]
  const provenance = found.value

  const statement = decodeStatement(
    Buffer.from(provenance.bundle.dsseEnvelope.payload, "base64").toString("utf8")
  )
  if (Option.isNone(statement)) return [`${id}: unreadable provenance statement`]

  const problems: Array<string> = []
  const subject = `pkg:npm/${Str.replace("@", "%40")(release.name)}@${release.version}`
  const digests = Arr.map(
    Arr.filter(statement.value.subject, (entry) => entry.name === subject),
    (entry) => entry.digest.sha512 ?? ""
  )
  if (!digests.includes(release.sha512Hex)) {
    problems.push(
      `${id}: provenance subject is not this tarball (${Arr.join(digests, ", ") || "none"})`
    )
  }

  const { workflow } = statement.value.predicate.buildDefinition.externalParameters
  if (workflow.repository !== repository || workflow.path !== releaseWorkflowPath) {
    problems.push(
      `${id}: built by ${workflow.repository} ${workflow.path}, not the release workflow`
    )
  }
  return problems
}
