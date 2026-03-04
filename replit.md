# xucasa — Real Estate Listing Platform

## Overview

xucasa is a Redfin-inspired real estate web application that allows users to browse, search, save, and list properties. It features a buyer-facing interface with map integration, property detail pages with public records data, and an agent portal for managing listings.

Key features:
- Property search with filters (location, price, beds, baths, sqft, HOA fee, off-market)
- Interactive Google Maps view with property markers (real geocoordinates) and Street View
- Property detail pages with neighborhood stats, flood zone info, and nearby places (public APIs)
- **Client Dashboard** — profile editor, My Home tracker with property intelligence, favorites with custom lists (create, rename, delete lists; move properties between lists), saved searches, search history
- **Sell Wizard** (`/sell`) — 6-step homeowner sell flow: address (Google Autocomplete + Street View preview), home details, instant valuation from comparable sales (beds/sqft matching), selling goals (timeline/motivation), contact + listing type (MLS public vs. Buy it Now private), confirmation. Saves leads to `sell_leads` DB table. Valuation via `/api/valuation`.
- **Buyer Marketplace** (`/buyers`) — Reverse buyer marketplace where pre-approved buyers create profiles listing their home needs (budget, beds, baths, sqft, lot size, home types, preferred cities, must-haves, nice-to-haves, deal-breakers, move-in timeline, bio). Homeowners browse buyer cards and pitch their properties directly to matching buyers via a message + optional property selection. Filter buyers by city, min/max budget. Inline CTA form, mock buyer examples, 100K+ stats for social proof.
- **Seller Pitch** — On the Sell wizard Step 2, homeowners can pitch their home to buyers by uploading photos, entering asking price, description. Pitches go to the site admin (not directly to buyers) for review and matching. Stored in `seller_pitches` DB table.
- **Agent Buyer Clients** — Agents can add buyer clients from the Agent Dashboard Clients tab. Client contact info (name, email, phone) is private and never shown publicly. When a seller pitches to an agent-represented buyer, the seller's info goes to the admin first, who then routes it to the agent. Buyer profiles created by agents have `agentId` set, and display "Represented buyer" on the Buy page.
- **Pre-Approval & Agent Questions** — During buyer profile creation, users answer: (1) Are you pre-approved? If yes, they can upload a letter and provide lender info. If no, they're flagged for admin lender referral. (2) Do you have an agent? If yes, they provide agent contact info; if the agent has an account, profiles are auto-linked. If no, they're flagged for admin agent referral. Referral needs visible in Admin → Referrals tab.
- **Seller Pre-Buy & Agent Questions** — During the Sell wizard (Step 5), homeowners answer: (1) "Will you need to buy your next home?" If yes, they're flagged for admin lender referral. (2) "Do you have a real estate agent?" If yes, they provide agent contact info; if the agent has an account, they're auto-detected. If no, they're flagged for admin agent referral. Referral needs visible in Admin → Referrals tab under "Seller Referrals."
- **Admin Dashboard** (`/admin`) — Master admin panel (restricted to admin email via `ADMIN_EMAIL` env var) with overview stats, seller pitch management (view/update status/add notes), sell leads list, buyer and seller referral management, and full user management. Tabs: Overview, Users, Seller Pitches, Sell Leads, Buyers, Referrals. Status workflow: new → reviewing → contacted → matched → rejected.
- **Admin Users Tab** — Full user management: search/filter/sort users by role (user/agent/admin) and status (active/suspended/banned). Per-user cards show profile, email, activity summary (listings, saved, searches, buyer profiles, pitches, etc.), join/login dates. Expand to manage role, account status, admin notes, or delete user with full cascading data removal (transactional). PATCH validated with Zod enum constraints. Self-deletion and self-suspension prevented.
- Agent dashboard for creating, editing, and deleting listings with Street View auto-photo
- **PWA (Progressive Web App)** — installable on iOS/Android home screens, offline-capable service worker, app manifest with icons
- **ADA / WCAG 2.1 AA Compliance** — skip-to-content link, global focus-visible outlines, semantic landmarks (header/nav/main/footer with ARIA roles), form label associations (htmlFor/id), accessible modals (role="dialog", aria-modal, focus trapping, Escape key), aria-labels on all icon-only buttons, aria-hidden on decorative icons, aria-pressed on toggle buttons, role="status" on loading spinners with sr-only text, descriptive image alt text, viewport allows user zoom
- Authentication via Google OAuth SSO (Sign in with Google)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

- **Framework**: React 18 with TypeScript, bundled by Vite
- **Routing**: `wouter` (lightweight client-side routing)
- **State/Data Fetching**: TanStack React Query v5 — all server data is fetched and cached via custom hooks (`use-properties`, `use-saved`, `use-auth`)
- **UI Components**: shadcn/ui (New York style) built on Radix UI primitives, styled with Tailwind CSS
- **Styling**: Tailwind CSS with CSS custom properties for theming. Redfin-inspired red primary color. Fonts: DM Sans (body) + Outfit (headings)
- **Forms**: React Hook Form + Zod resolvers
- **Maps**: Google Maps JavaScript API via `@react-google-maps/api` — uses AdvancedMarkerElements and Street View Panorama. Requires `VITE_GOOGLE_MAPS_API_KEY` env var
- **URL Params**: `query-string` for serializing search filters into query strings

**Pages:**
- `/` — Home with hero search and featured listings
- `/search` — Property search with filters + split map/list view
- `/property/:id` — Property detail with map, public records panel
- `/dashboard` — Client dashboard: profile, My Home tracker, favorites, saved searches, search history
- `/agent` — Agent dashboard (list/create/edit/delete own properties with Street View photo)

### Backend

- **Framework**: Express.js (TypeScript, ESM)
- **Entry**: `server/index.ts` → registers routes, sets up Vite dev middleware or static serving
- **API Design**: Route paths and Zod validation schemas are defined in `shared/routes.ts`, shared between client and server
- **Storage Layer**: `server/storage.ts` — `DatabaseStorage` class implementing `IStorage` interface; all DB queries go through Drizzle ORM
- **Public Records**: `server/publicRecords.ts` fetches from Census Geocoder, ACS, FEMA NFHL, and OpenStreetMap Overpass APIs to enrich property detail pages
- **Build**: Custom `script/build.ts` — runs Vite build for the client, then esbuild for the server into `dist/`

### Database

- **Database**: PostgreSQL
- **ORM**: Drizzle ORM (`drizzle-orm/node-postgres`) with `drizzle-kit` for migrations
- **Schema** (`shared/schema.ts`):
  - `users` — auth user profiles (id, email, firstName, lastName, profileImageUrl)
  - `sessions` — server-side session storage for Replit Auth (mandatory, managed by `connect-pg-simple`)
  - `properties` — listings with address fields, price, beds, baths, sqft, lotSize, hoaFee, status, agentId, imageUrl, isOffMarket, lat, lng
  - `savedProperties` — join table: userId + propertyId
  - `savedSearches` — userId + name + JSONB criteria
  - `searchHistory` — userId + query string + JSONB criteria (auto-logged from Search page, last 50 per user)
  - `userHomes` — userId + address fields + nickname + notes + lat/lng + imageUrl (Street View auto-photo)
  - `buyerProfiles` — userId, displayName, preApprovalAmount, bed/bath/sqft ranges, preferredCities[], homeTypes[], mustHaves[], niceToHaves[], dealBreakers[], moveInTimeline, bio, isActive
  - `buyerMatches` — buyerProfileId, propertyId (optional), senderId, message, status (pending/accepted/rejected)
  - `sellerPitches` — userId (optional), name, email, phone, fullAddress, beds, baths, sqft, lotSize, price, homeType, condition, description, photos[], timeline, status (new/reviewing/contacted/matched/rejected), adminNotes
- **Migrations**: `./migrations/` directory, applied with `drizzle-kit push`

### Authentication

- **Provider**: Google OAuth 2.0 SSO via `passport-google-oauth20`, implemented in `server/replit_integrations/auth/`
- **Strategy**: `passport-google-oauth20` with Google profile data (name, email, photo) stored in the `users` table; Google profile ID used as user ID
- **Sessions**: `express-session` backed by PostgreSQL (`connect-pg-simple`) using the `sessions` table; 1-week TTL; secure/httpOnly cookies
- **Admin detection**: Email-based via `ADMIN_EMAIL` env var (currently `david@listedbydavid.com`); `/api/auth/user` returns `isAdmin` flag; server-side admin middleware checks email match
- **Required env vars**: `DATABASE_URL`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAIL`
- **Client side**: `useAuth` hook fetches `/api/auth/user`; login buttons redirect to `/api/auth/google`; AuthPromptModal shows "Continue with Google" button
- **Routes**: `/api/auth/google` (initiate), `/api/auth/google/callback` (OAuth callback), `/api/logout` (session destroy)

### API Structure

All API routes are defined in `shared/routes.ts` with typed paths and Zod schemas:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/properties` | Public | List/search properties |
| GET | `/api/properties/:id` | Public | Get single property |
| POST | `/api/properties` | Required | Create listing |
| PUT | `/api/properties/:id` | Required | Update listing |
| DELETE | `/api/properties/:id` | Required | Delete listing |
| GET | `/api/saved-properties` | Required | Get user's saved homes |
| POST | `/api/saved-properties` | Required | Save a property |
| DELETE | `/api/saved-properties/:propertyId` | Required | Unsave a property |
| GET | `/api/saved-searches` | Required | Get saved searches |
| POST | `/api/saved-searches` | Required | Save a search |
| DELETE | `/api/saved-searches/:id` | Required | Delete a saved search |
| GET | `/api/public-records/:id` | Public | Fetch public records for a property |
| GET | `/api/auth/user` | Required | Get current user |
| GET | `/api/auth/google` | — | Initiate Google OAuth |
| GET | `/api/auth/google/callback` | — | Google OAuth callback |
| GET | `/api/logout` | — | Log out |

## External Dependencies

### APIs & Services

- **Google Maps JavaScript API** — Map display, AdvancedMarkerElements, Street View, Places Autocomplete (for agent address input). Requires `VITE_GOOGLE_MAPS_API_KEY` (client-side).
- **US Census Geocoder** (`geocoding.geo.census.gov`) — Geocode property addresses to lat/lng + FIPS codes. No API key needed.
- **US Census ACS5** (`api.census.gov/data/2023/acs/acs5`) — Neighborhood statistics: median income, home value, population, owner-occupancy rate by census tract. No API key needed.
- **FEMA NFHL** (`hazards.fema.gov`) — Flood zone data (Special Flood Hazard Area classification). No API key needed.
- **OpenStreetMap Overpass API** (`overpass-api.de`) — Nearby places: schools, parks, hospitals, transit, grocery stores within a radius. No API key needed.
- **Google OAuth 2.0** — User authentication via Google accounts. Requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars.

### Key npm Packages

| Package | Purpose |
|---------|---------|
| `drizzle-orm` + `pg` | PostgreSQL ORM and driver |
| `drizzle-kit` | DB schema push/migrations |
| `express` + `express-session` | HTTP server and session management |
| `passport` + `passport-google-oauth20` | Google OAuth authentication |
| `connect-pg-simple` | PostgreSQL session store |
| `@tanstack/react-query` | Server state management |
| `wouter` | Client-side routing |
| `@react-google-maps/api` | Google Maps React wrapper |
| `react-hook-form` + `zod` | Form validation |
| `query-string` | URL query param serialization |
| `shadcn/ui` + Radix UI | Accessible UI primitives |
| `tailwindcss` | Utility-first CSS framework |
| `vite` | Frontend build tool and dev server |
| `memoizee` | Memoize OIDC config fetch |

### IDX Broker / MLS Sync

`server/idxSync.ts` is a complete IDX Broker REST API sync engine. When activated it:
- Fetches all active MLS listings (paginated, 500/page)
- Upserts them into the `properties` table with `source = 'idx'` and a unique `idx_id`
- Marks listings removed from the feed as `status = 'removed'`
- Auto-syncs every 4 hours in the background
- Also supports RESO Web API (OAuth2 / OData) as an alternative

**To activate:**
1. Sign up at idxbroker.com and get MLS-approved
2. Copy API key from: Account → API → Access Key
3. Add `IDX_BROKER_API_KEY` as an environment secret
4. Server auto-syncs on startup and every 4 hours

**Admin UI:** The IDX Sync Panel is visible at the bottom of the Agent Dashboard (`/agent`).

**API routes:**
- `GET /api/idx/status` — sync status, last run, history, listing count
- `POST /api/idx/sync` — trigger manual sync

### Environment Variables Required

```
DATABASE_URL          # PostgreSQL connection string
SESSION_SECRET        # Secret for signing session cookies
GOOGLE_CLIENT_ID      # Google OAuth 2.0 client ID
GOOGLE_CLIENT_SECRET  # Google OAuth 2.0 client secret
ADMIN_EMAIL           # Admin user email for admin panel access
VITE_GOOGLE_MAPS_API_KEY  # Google Maps JS API key (client-side)
IDX_BROKER_API_KEY    # (optional) IDX Broker API key — activates MLS sync
IDX_RESO_URL          # (optional) RESO Web API base URL — alternative to IDX Broker
IDX_RESO_TOKEN        # (optional) RESO Web API Bearer token
```