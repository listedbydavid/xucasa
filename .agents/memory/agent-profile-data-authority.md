---
name: Agent profile data authority
description: The precedence and privacy boundary for MLS-sourced agent profiles and owner corrections.
---

Keep MLS snapshots, agent-authored corrections, and field-level visibility preferences as separate data layers. Resolve display values from correction first, then MLS, then verified account data; clearing a correction must reveal the source value again.

**Why:** Agents need to fix syndicated inaccuracies without destroying the original MLS record, and they need independent control over which contact, license, and brokerage fields other agents can see.

**How to apply:** MLS refreshes may update snapshot fields only. Owner updates may change corrections and visibility only. Every directory and profile response must apply visibility after value resolution, including brokerage fields.