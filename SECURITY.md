# Security policy

## Report a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/thenamespace/namera/security/advisories/new)
to report suspected vulnerabilities. Do not open a public issue or pull request with exploit details
before a fix is available.

Include the affected package or component and version, a minimal reproduction, expected and observed
behavior, and the potential impact. Redact API keys, tokens, credentials and personal data.

Reproduce issues locally or against accounts and infrastructure you control. Do not access other
users' data, disrupt public services, or test against systems without permission.

## Supported versions

Security fixes target the latest stable release. Older releases and prereleases do not receive
guaranteed backports.

## Scope

Reports about input validation, injection, authentication, data exposure and dependency integrity
are welcome. Documentation that leads to unsafe use is also in scope.
Package publishing and release integrity (npm provenance, tarball contents) are in scope too.
Vulnerabilities solely in a dependency should be reported to that project's security channel.

## Disclosure

The maintainer investigates privately and coordinates the fix and disclosure with the reporter.
Accepted reports may result in a GitHub security advisory and a patched release. This policy does not
promise a response deadline or a bounty.
