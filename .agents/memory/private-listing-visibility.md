---
name: Private listing visibility
description: The authorization boundary for private agent-created listings across all property-derived features.
---

Draft status is a global property-visibility boundary. A draft is visible only to the exact agent owner; being authenticated, verified, assigned to a buyer, or part of an old conversation does not grant access.

**Why:** Property IDs are enumerable, and seemingly secondary routes such as saved homes, reviews, showings, enrichment data, autocomplete, and photo delivery can reveal a draft even when search and detail pages correctly hide it.

**How to apply:** Any endpoint or asset lookup that accepts, joins, or derives data from a property must enforce the same visibility policy before returning data or creating side effects. Non-owner payloads for published listings must also strip confidential fields.