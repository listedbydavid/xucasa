---
name: Dependency audit interpretation
description: Limits of version-only scans when archived manifests or local patches are present
---

Do not equate an upstream-version finding with proof that a local security patch
is ineffective, and do not claim a zero-finding scan when patched versions are
still reported.

**Why:** The project's dependency scanner identifies upstream package versions,
not the behavior of pnpm-patched source. It also includes dependency lockfiles
outside the active workspace, including archived migration material.

**How to apply:** Check which lockfile owns each finding. Retire obsolete install
targets transparently rather than suppressing the scan. For packages with no
published fix, use reproducible patches and adversarial regression tests through
the real consumer dependency graph; disclose remaining scanner findings until
upstream fixed releases are available.

After a checkout or task merge, synchronize the installed dependency graph before
judging whether committed patches protect runtime consumers.

**Why:** This workspace had correctly committed patch registrations and hashes,
but existing consumer links still resolved to unpatched packages until a frozen
installation refreshed them.

**How to apply:** Run the frozen installation, then test the actual consumer
paths and malicious inputs. A correct lockfile alone does not establish that a
currently running process uses patched code.
