---
name: xucasa cross-origin sessions
description: Browser and native session rules for the Expo client talking to the xucasa API during Replit development.
---

The Expo web preview and API are served from sibling development origins, so browser cookie sessions are a cross-origin concern even though both belong to the same application.

**Why:** A policy that treats all Replit subdomains as trusted exposes credentialed API responses to unrelated applications.

**How to apply:** Treat every browser origin as untrusted unless it is explicitly configured for the current application.

Do not rely on Expo Go exposing or replaying an HTTP-only `Set-Cookie` header. Native authentication needs a SecureStore-backed bearer session, while browser authentication should retain HTTP-only cookies.

**Why:** A physical Expo login can succeed on the server and still receive an immediate 401 on the next authenticated request because the native fetch layer does not make the session cookie available to the app.

**How to apply:** Keep the native credential response opt-in, validate it through the server's normal session verifier, and confirm logout invalidates both the server session and device credential.