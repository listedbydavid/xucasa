---
name: xucasa cross-origin sessions
description: Browser and native session rules for the Expo client talking to the xucasa API during Replit development.
---

The Expo web preview and API are served from sibling development origins, so browser cookie sessions are a cross-origin concern even though both belong to the same application.

**Why:** A policy that treats all Replit subdomains as trusted exposes credentialed API responses to unrelated applications.

**How to apply:** Treat every browser origin as untrusted unless it is explicitly configured for the current application.