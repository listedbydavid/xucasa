---
name: Git history rewrites
description: Replit-specific constraints for safely removing sensitive content from Git history.
---

When rewriting Git history in this workspace, do not use a tree-filter that checks out or deletes historical `.replit` files. Prefer an index-filter or direct Git-object transformation, and restore the current `.replit` only through Replit's validated replacement mechanism.

**Why:** A tree-filter that touched historical `.replit` content interrupted the shell before any refs were rewritten, while an index-only rewrite completed successfully without disturbing the workspace configuration.

**How to apply:** Transform affected blobs through a temporary index, remove `.replit` from commit trees, delete `refs/original`, expire reflogs, prune old objects, and verify all reachable refs before force-pushing.