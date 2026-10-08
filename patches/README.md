# Dependency security patches

Most dependency advisories are resolved by updated releases in the workspace
lockfile. Two upstream packages have no published fix as of 2026-10-08.
Do not remove these patches just because the latest upstream version is installed.
pnpm applies them automatically via `patchedDependencies`, including frozen installs.

## braces 3.0.3 — GHSA-vfj7-8cjw-p6xm

Reject string nesting beyond 100 levels before the parser calls a recursive
walker. Validate directly supplied ASTs iteratively before compile, expand, and
stringify, rejecting excessive depth, excessive node counts, and cycles.
Ordinary glob patterns retain the upstream behavior; pathological patterns fail
explicitly with `SyntaxError`.

## node-forge 1.4.0 — GHSA-86w9-cpqp-85rv

RSA PKCS#1 v1.5 verification must validate the nested DigestAlgorithm element
count, not only the outer DigestInfo count. Require exactly one OID plus the
optional NULL parameter already accepted by the validator. Extra nested elements
are rejected before comparing the digest. Standard SHA signatures with either
permitted parameter encoding remain valid.

## Verification and limitations

Run `pnpm --filter @workspace/scripts test:dependency-security`.
The regression tests resolve packages through the actual Expo/Metro consumers.
They check normal behavior and the advisory's malformed input cases.

Version-only dependency scanners still report these two upstream versions:
local patches do not change their published version numbers. These are patched
findings, not evidence of a zero-finding scan. Replace each patch with an upstream
fixed release when available, retaining the regression tests.

Other compatibility-sensitive overrides keep the existing Expo SDK and React
Native versions. Metro 0.83.3 uses the fixed image-size 2.x parser through a
small named-export and buffer-input compatibility patch. Moving Expo SDK 54 to Metro 0.83.8
changed file-watcher event payloads and crashed the Expo CLI on file changes;
keeping its original Metro version preserves hot reload. UUID 11 is used rather than the ESM-only latest
major so CommonJS tooling remains compatible. The js-yaml override is restricted
to load-nyc-config, which only uses the compatible `load()` API.

Rollup remains pinned to the prior 4.62.3 release. The compatible dependency
refresh selected 4.64.2, whose tree-shaker stalled both web builds; CPU profiling
identified repeated call-argument inclusion and garbage collection. This is a
compatibility pin, not an audit suppression.
