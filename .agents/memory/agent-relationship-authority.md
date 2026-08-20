---
name: Agent relationship authority
description: The authorization boundary between buyer assignments and materialized client-link records.
---

Treat the buyer's assigned agent as the sole authoritative representation relationship. Client-link rows are materialized dashboard projections and must never independently grant access.

**Why:** Historical or duplicate client-link rows can outlive a representation change. Authorizing from those stale rows would let a former agent act on a buyer now represented by someone else.

**How to apply:** Require the buyer's current assigned agent for access and current-agent notification routing. Treat link, offer, conversation, showing, and interest agent IDs as historical metadata only. Update assignment and its client-link projection atomically.