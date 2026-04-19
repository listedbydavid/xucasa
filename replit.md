# xucasa — Real Estate Listing Platform

## Overview

xucasa is a Redfin-inspired real estate web application designed for browsing, searching, saving, and listing properties. It serves both buyers and agents, offering an interactive map interface, detailed property pages with public records data, and an agent portal for listing management. Key features include a client dashboard, a Sell Wizard for homeowners, a reverse buyer marketplace, robust admin functionalities, agent verification, and PWA capabilities. The platform aims to streamline the real estate process by providing a feature-rich and accessible user experience.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

- **Framework**: React 18 with TypeScript, bundled by Vite.
- **Routing**: `wouter` for client-side routing.
- **State/Data Fetching**: TanStack React Query v5.
- **UI Components**: shadcn/ui (New York style) built on Radix UI and Tailwind CSS, with Redfin-inspired theming.
- **Maps**: Google Maps JavaScript API via `@react-google-maps/api`, utilizing AdvancedMarkerElements and Street View.
- **Address Autocomplete**: Reusable component providing property and location suggestions.
- **Loading States**: Uses skeleton/shimmer loading states.
- **Mobile Responsiveness**: Fixed bottom contact bar, responsive grids, and scaled typography.
- **Core Features**:
    - **Property Search & Filters**: Redfin-style split layout with sticky map and scrollable property list. Includes price-bubble map markers and a Layers control panel with Standard/Satellite view and Lot Lines overlay (Regrid parcel data).
    - **Property Details**: Enhanced with mortgage calculator, neighborhood insights, Agent MLS Panel (for verified agents), 3D Virtual Tour embedding, and Schools Section (nearby schools by level with district, GreatSchools links, distances).
    - **Hero Address Flow**: Autocomplete for Buy, Sell, and Estimate sections, with dynamic location suggestions based on city and county.
    - **Agent CRM (Contacts)**: Full contact management with search, tag filtering, add/edit, CSV import, and phone contacts import.
    - **Home Report**: Comprehensive property analysis tool inspired by Homebot, including valuation, equity, nearby sales, and financial calculators.
    - **Sell Page Auto-Populate**: Auto-fills property details from MLS records when an address is entered.
    - **Post-Signup Onboarding Router**: Intent-based onboarding flow at `/onboarding` with four paths (buyer, homeowner, agent, explorer). Buyer wizard collects budget/areas/beds/baths/timeline, homeowner wizard collects address/details/selling-intent, agent wizard collects license/brokerage/MLS info. Explorer fast-tracks to `/swipe`. OnboardingGuard redirects unauthenticated protected routes. Users table has `primaryIntent`, `onboardingCompleted`, `buyerProfileCompleted`, `homeownerProfileCompleted`, `agentProfileCompleted`, `agentVerificationStatus`, `currentMode` columns. Intent-aware post-login routing: buyer/explorer→`/swipe`, homeowner→`/home-report`, agent→`/agent`, incomplete→`/onboarding`. Mode switching via `POST /api/onboarding/switch-mode` (validates profile completion before allowing). ModeSwitcherSection in Dashboard profile for users with multiple completed profiles. ActivateProfileSection lets users add additional profiles via `?reentry=1&intent=X`.
    - **Reverse Offer / Swipe Interest System**: Facilitates buyer interest and reverse offers with notification triggers.
    - **Core Loop (Agent-Mediated Communication)**: All buyer communication routes through their assigned agent (never directly to listing agents). Two conversation types: `buyer` (buyer↔assigned-agent, buyer-visible) and `agent_coordination` (assigned-agent↔listing-agent, agent-only). Schema: `buyer_interest` (with assignedAgentUserId, listingAgentUserId, buyerConversationId, agentCoordinationConversationId), `conversations` (with type field), `messages`, `showing_requests`. Users table has `assignedAgentUserId` for agent assignment. Agent auto-assignment logic uses clientAgentLinks or platform admin fallback. Buyer interest stages: interested → agent_reviewing → coordinating → showing_scheduled → offer_stage → closed.
    - **Property Ratings & Reviews**: Users can rate and review properties, with visibility toggled by agents/admins.
    - **Error Tracking & Crash Reporting**: Automated frontend and backend error monitoring with an admin dashboard for management and archiving.
    - **Notification System**: In-app notifications with unread counts, a dropdown panel, and full dashboard management.
    - **Email Notification System**: Gmail API-based email notifications with user-configurable preferences, branded HTML templates, and rate limiting.
    - **Progressive Web App (PWA)**: Full PWA support with splash screens, service worker caching, offline fallback, and smart install banners.

### Backend

- **Framework**: Express.js (TypeScript, ESM).
- **API Design**: Route paths and Zod validation schemas defined for client-server consistency.
- **Storage Layer**: `DatabaseStorage` class implementing `IStorage` interface, using Drizzle ORM.
- **Public Records**: Integrates data from Census Geocoder, ACS, FEMA NFHL, and OpenStreetMap Overpass APIs.

### Database

- **Database**: PostgreSQL.
- **ORM**: Drizzle ORM (`drizzle-orm/node-postgres`) with `drizzle-kit push` (push-based, no migration files).
- **Schema**: `shared/schema.ts` is the single source of truth. Includes tables for users, sessions, properties, saved items, search history, user homes, buyer/seller profiles, agent contacts, conversations, messages, showing requests, buyer interest, property offers, and notifications.
- **Migration Strategy**: Push-based via `drizzle-kit push --force` (non-interactive). See `MIGRATION_STRATEGY.md` for full details.
- **Post-Merge**: `scripts/post-merge.sh` runs `npm install` + `drizzle-kit push --force` + DB connectivity check. Timeout: 60s.
- **Schema Drift**: Detected via `scripts/db-check-drift.sh` and `scripts/db-verify-constraints.sh`. See `SCHEMA_DRIFT_POLICY.md`.
- **Known Issue**: `buyer_interest.agent_coordination_conversation_id` FK name exceeds Postgres 63-char limit, causing harmless re-application on each push. Documented in `SCHEMA_DRIFT_POLICY.md`.

### Authentication

- **Providers**: Google OAuth 2.0 SSO and email/password via bcryptjs.
- **Sessions**: `express-session` backed by PostgreSQL with secure cookies and "Remember Me" option.
- **Roles**: Supports Admin and Agent roles.
- **Rate Limiting**: `express-rate-limit` on register (5/15min), login (10/15min), onboarding (10/15min). Forgot-password has dual rate limiting: per-IP (5/10min) + per-email (3/hour) with `forgot_password_rate_limited` audit event on block.
- **Validation**: Strict Zod schemas for register/login/reset; passwords require 10+ chars with uppercase, lowercase, digit, and special character.
- **Password Reset Flow**: `POST /api/auth/forgot-password` (dual rate-limited, no user enumeration — always returns 200), `POST /api/auth/reset-password` (atomic token claim via single UPDATE...WHERE...RETURNING, strong password enforcement). Tokens are SHA-256 hashed in DB (`password_reset_tokens` table), 1-hour expiry, single-use. Branded HTML email sent via Gmail API (`sendPasswordResetEmail`). On successful reset: all user sessions are invalidated via `invalidateUserSessions`. Frontend: "Forgot password?" on login form, `/reset-password?token=...` page with real-time password strength checklist (10+ chars, uppercase, lowercase, digit, symbol).
- **Production Email Blocking**: Configurable blocked email patterns list in `server/authMiddleware.ts`.
- **Account Source Tracking**: `accountSource` field on users (real/test/seed/e2e) for filtering test accounts.
- **Audit Logging**: All auth attempts logged with IP, email, action, result, and timestamp.
- **Cleanup Service**: `server/cleanupService.ts` provides list/disable/delete for suspicious accounts with FK-safe deletion.
- **Seed Gate**: `seedDatabase()` only runs in non-production environments.

### Observability & Audit

- **Structured Logger**: `server/logger.ts` emits JSON-formatted log entries with level, event, timestamp, and request context.
- **Request Correlation**: `server/requestId.ts` middleware assigns UUID correlation IDs to every request (uses `x-request-id` header or generates new).
- **Audit Event Tracking**: `server/auditLog.ts` provides `audit()` for fire-and-forget logging and `executeWithAudit<T>()` generic wrapper that auto-handles success/failure audit logging and DB persistence. Handler returns `{ data, auditOverrides? }`. All critical mutation routes use `executeWithAudit`, eliminating manual try/catch audit duplication. Includes 2x retry with 200ms backoff on persistence failures, `validateAuditEvent()` shape checking, and structured `audit_retry_attempt`/`audit_final_failure`/`audit_validation_failed` health events.
- **Instrumented Events**: `auth_login_success/failure`, `auth_register_success`, `forgot_password_requested`, `forgot_password_email_sent`, `password_reset_completed`, `password_reset_token_invalid/expired`, `onboarding_completed`, `mode_switched`, `swipe_interest_created`, `reverse_offer_created`, `buyer_offer_response`, `buyer_interest_upserted`, `conversation_created`, `coordination_thread_created`, `message_sent`, `showing_request_created`, `showing_status_changed`, `authorization_denied`, `unexpected_server_error`.
- **Audit Scripts**: `scripts/find-unaudited-mutations.ts` scans all server route files for POST/PUT/PATCH/DELETE handlers missing `audit()` or `executeWithAudit` calls. `scripts/verify-audit-integrity.ts` checks DB integrity (null events, invalid outcomes, orphaned user refs, event distribution, system health events).
- **Admin Audit Dashboard**: "Audit Log" tab in Admin panel with stats (total events, failures, success rate), event type filter, and event detail cards. API: `GET /api/admin/audit-events`, `GET /api/admin/audit-events/failures`, `GET /api/admin/audit-events/stats`.

## External Dependencies

### APIs & Services

- **Google Maps JavaScript API**: For map display, Street View, and Places Autocomplete.
- **US Census Geocoder**: For geocoding and FIPS codes.
- **US Census ACS5**: For neighborhood demographic and economic statistics.
- **FEMA NFHL**: For flood zone data.
- **OpenStreetMap Overpass API**: For nearby places information.
- **Google OAuth 2.0**: For user authentication.
- **RealtyFeed / MLS Sync**: Integrates with RealtyFeed (RESO OData) for MLS listing synchronization, with IDX Broker REST API as a fallback.
## Testing

Integration tests live in `server/__tests__/*.test.ts` and run via Node's
built-in test runner with `tsx`. Run them with:

```
bash scripts/run-tests.sh
```

Tests require `DATABASE_URL` (they seed and clean up their own fixtures using
fixed test IDs).

- `server/__tests__/beacon.test.ts` — pure-function unit tests against the
  exported scoring helpers in `server/storage.ts` (`scoreBuyer`,
  `passesBudgetGate`, `minBuyerBudget`). Covers tier thresholds, budget gate
  boundaries, en-dash/hyphen equivalence, and null/empty edge cases. No DB
  required.
- `server/__tests__/beacon.integration.test.ts` — DB-backed integration test
  that seeds 1 Strong / 1 Good / 1 Potential buyer against a known listing
  and asserts the full `matchScore`, `matchTier`, `scoreBreakdown`, and
  descending sort order returned by `storage.matchBuyersForListing`.
  Requires `DATABASE_URL`.
