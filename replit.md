# xucasa — Real Estate Listing Platform

## Overview

xucasa is a Redfin-inspired real estate web application designed for browsing, searching, saving, and listing properties. It offers a comprehensive platform for both buyers and agents, featuring an interactive map interface, detailed property pages with public records data, and an agent portal for managing listings. The platform aims to streamline the real estate process, offering tools like a client dashboard for buyers, a Sell Wizard for homeowners, and a reverse buyer marketplace. It also includes robust admin functionalities, agent verification, and PWA capabilities, ensuring an accessible and feature-rich user experience.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

- **Framework**: React 18 with TypeScript, bundled by Vite.
- **Routing**: `wouter` for lightweight client-side routing.
- **State/Data Fetching**: TanStack React Query v5 for server data fetching and caching.
- **UI Components**: shadcn/ui (New York style) built on Radix UI primitives, styled with Tailwind CSS.
- **Styling**: Tailwind CSS with custom properties for Redfin-inspired theming (red primary color). Fonts: DM Sans (body) + Outfit (headings).
- **Forms**: React Hook Form + Zod resolvers.
- **Maps**: Google Maps JavaScript API via `@react-google-maps/api`, utilizing AdvancedMarkerElements and Street View Panorama.
- **URL Params**: `query-string` for serializing search filters into query strings.

### Backend

- **Framework**: Express.js (TypeScript, ESM).
- **API Design**: Route paths and Zod validation schemas defined in `shared/routes.ts` for client-server consistency.
- **Storage Layer**: `server/storage.ts` with `DatabaseStorage` class implementing `IStorage` interface, using Drizzle ORM for all DB queries.
- **Public Records**: `server/publicRecords.ts` integrates data from Census Geocoder, ACS, FEMA NFHL, and OpenStreetMap Overpass APIs.
- **Build**: Custom `script/build.ts` orchestrates Vite build for the client and esbuild for the server.

### Database

- **Database**: PostgreSQL.
- **ORM**: Drizzle ORM (`drizzle-orm/node-postgres`) with `drizzle-kit` for migrations.
- **Schema**: Includes tables for `users`, `sessions`, `properties`, `savedProperties`, `savedSearches`, `searchHistory`, `userHomes`, `buyerProfiles`, `buyerMatches`, and `sellerPitches`.
- **Properties table** includes `property_type` column for abbreviated type (SFH, Condo, Townhome, Land, 2-4 Unit, etc.), synced from MLS PropertyType/PropertySubType.

### Authentication

- **Providers**: Google OAuth 2.0 SSO via `passport-google-oauth20` AND email/password via bcryptjs.
- **Email/Password Auth**: `POST /api/auth/register` (email, password, firstName, lastName) and `POST /api/auth/login` (email, password). Auth page at `/auth`.
- **Google OAuth**: Google profile data (name, email, photo) stored in the `users` table; Google profile ID as user ID.
- **Sessions**: `express-session` backed by PostgreSQL (`connect-pg-simple`) with 1-week TTL (or 30 days with "Remember me") secure/httpOnly cookies.
- **Remember Me**: Login form checkbox extends session cookie maxAge from 1 week to 30 days.
- **Admin detection**: Email-based via `ADMIN_EMAIL` environment variable.
- **Agent role**: Users with `role='agent'` get the "Agent Dashboard" nav tab and full agent capabilities. David Hussain (`david@listedbydavid.com`) is set as agent+admin.

## External Dependencies

### APIs & Services

- **Google Maps JavaScript API**: For map display, Street View, and Places Autocomplete.
- **US Census Geocoder**: For geocoding addresses and FIPS codes.
- **US Census ACS5**: For neighborhood demographic and economic statistics.
- **FEMA NFHL**: For flood zone data.
- **OpenStreetMap Overpass API**: For nearby places information (schools, parks, etc.).
- **Google OAuth 2.0**: For user authentication.
- **RealtyFeed / MLS Sync**: Integrates with RealtyFeed (RESO OData) for MLS listing synchronization, including geographic filtering, batch upserts, and status updates. Falls back to IDX Broker REST API if configured.

### Properties API Pagination

- `GET /api/properties` returns `{ properties: PropertyResponse[], total: number, limit: number, offset: number }` (not a plain array).
- Default limit: 50, max limit: 200. Limit and offset are normalized/clamped in the route handler before being passed to storage.
- All frontend consumers (Home, Search, Swipe, AgentDashboard, use-properties hook) use `.properties` accessor on the response.
- Search page resets to page 0 when filters/query change.
- `getPropertiesCount(filters?)` method provides total count without fetching rows.

### Address Autocomplete

- `GET /api/properties/autocomplete?q=<query>&limit=8` returns lightweight property suggestions (id, title, price, beds, baths, sqft, status, isOffMarket, imageUrl, addressCity/State/Zip).
- `AddressAutocomplete` component (`client/src/components/AddressAutocomplete.tsx`) provides a reusable dropdown with property thumbnails, prices, bed/bath/sqft info, and status badges (Active/Off Market/Sold/Pending).
- Integrated into Home.tsx (hero tabbed search bar — Buy/Sell/Estimate tabs) and Search.tsx (search filter bar).
- Uses `onQueryChange` callback for parent state sync (no DOM queries). Uses default react-query fetcher with URL-based queryKey.
- Supports keyboard navigation (ArrowUp/Down, Enter, Escape), click-outside dismiss, and loading state.
- Google Geocoder used for map centering on Search page (replaced Google Places Autocomplete).

### Dark Mode

- ThemeToggle component at `client/src/components/layout/ThemeToggle.tsx` toggles `.dark` class on `document.documentElement`.
- Dark mode CSS variables defined in `client/src/index.css` under `.dark` selector.
- `tailwind.config.ts` has `darkMode: ["class"]`.
- Navbar, footer, and mobile nav use `bg-background` instead of hardcoded `bg-white`.
- Theme preference persisted in localStorage (`xucasa-theme`) with `prefers-color-scheme` fallback.

### Search Filters

- Search page supports: minPrice, maxPrice, beds, baths, propertyType, status (active/pending/sold), isOffMarket, sort (newest/price_asc/price_desc/sqft_desc).
- All filters defined in `shared/routes.ts` input schema and implemented in `server/storage.ts` `buildPropertyFilters`.
- Status filter uses case-insensitive LOWER() comparison.

### Property Detail Enhancements

- Mortgage Calculator: collapsible section with adjustable inputs (price, down payment, rate, term, tax, insurance, HOA).
- Neighborhood Section: fetches from `/api/properties/:id/public-records` and displays nearby schools, parks, groceries, transit, healthcare in card grid.
- Share button: uses Web Share API with clipboard fallback. Print button: calls `window.print()`.
- Mobile responsive: fixed bottom contact bar on mobile, responsive stats grid, scaled typography.

### Loading Skeletons

- Search, PropertyDetail, Dashboard, and Admin pages all use skeleton/shimmer loading states instead of spinners.

### Agent Beacon Report

- Feature for agents to generate branded PDF reports showing matched buyers for a prospective listing.
- **Backend**: `GET /api/beacon/match-buyers` (agent-only) matches active buyer profiles against listing criteria (price, beds, baths, sqft, city, propertyType).
- **Matching logic**: `storage.matchBuyersForListing()` checks budget >= price, bed/bath/sqft ranges, preferred cities (case-insensitive array match), and home types.
- **Frontend**: `BeaconTab` component in `client/src/components/BeaconReport.tsx`, rendered as a tab in AgentDashboard.
- **PDF generation**: Uses `jspdf` (client-side) to produce a branded PDF with xucasa logo, agent photo/contact/license/brokerage, property details, and matched buyer cards. Downloaded as `Beacon_Report_[Address]_[Date].pdf`.
- **User phone field**: Added `phone` varchar to users table for agent contact display on reports.
- Privacy: Buyer contact info (email, phone) is redacted from the report; only aggregate profile data shown.

### Buyer Marketplace Listings

- The `/buyers` page now shows property listings alongside buyer profiles.
- `MatchingListings` component in `Buyers.tsx` fetches from `/api/properties` with filters derived from the buyer's profile.
- **No profile**: Shows "Featured Listings" (newest 8 listings).
- **With profile**: Shows "Listings Matching Your Criteria" filtered by budget (maxPrice), beds, baths, sqft, preferred cities (location), and home types (propertyType). Criteria pills displayed above the grid.
- Property type mapping: "Single Family" → "SFH", "Condo" → "Condo", "Townhouse" → "Townhouse", etc.
- "Show More" button expands from 8 to 24; "See All on Search" links to `/search` with pre-filled filters.
- Listings cache is invalidated when buyer profile is created/updated.

### Buyer Profile Modal (Shared)

- `BuyerProfileModal` component at `client/src/components/BuyerProfileModal.tsx` — shared modal for creating/editing buyer profiles.
- Used in both the Buy page (`/buyers`) and the Dashboard (`/dashboard`) profile section.
- Dashboard shows a "Buyer Criteria" card summarizing budget, beds, baths, sqft, cities, home types, must-haves, pre-approval status, and agent status with an "Edit" button that opens the modal.

### Open House Route Planner

- Reusable `OpenHouseRoutePlanner` component (`client/src/components/OpenHouseRoutePlanner.tsx`) used in both buyer Dashboard and Agent Dashboard.
- Users select open houses via checkboxes, then click "Plan Route" to see a route preview map (Google Maps Embed API) and action buttons.
- `getFullAddress` helper always constructs fully qualified addresses (street, city, state, zip) for waypoints. Falls back to `title` + structured city/state/zip fields, then `location` field, to prevent Google/Apple Maps from geocoding to wrong cities.
- Generates Google Maps directions URLs with origin, destination, and waypoints for multi-stop routes.
- Generates Apple Maps URLs as an alternative for iPhone users.
- Buttons: "Open in Google Maps" (opens native app on mobile), "Open in Apple Maps", "Copy Link", and "Share" (Web Share API).
- No extra API usage — leverages Google Maps Embed API for preview and standard Maps URLs for navigation.

### Cookie Consent & Legal Pages

- **Cookie Consent Banner**: `CookieConsent` component at `client/src/components/CookieConsent.tsx`. Fixed bottom bar that appears on first visit, stores consent in `localStorage` (`xucasa-cookie-consent`). Uses shadcn `Button` components.
- **Privacy Policy**: `/privacy` route at `client/src/pages/PrivacyPolicy.tsx`. Covers data collection, cookies, third-party services (Google OAuth, Google Maps, RealtyFeed), data retention, user rights, CCPA.
- **Terms of Service**: `/terms` route at `client/src/pages/TermsOfService.tsx`. Covers account responsibilities, MLS data disclaimer, buyer marketplace, agent services, fair housing (id="fair-housing"), accessibility (id="accessibility"), governing law (California).
- **Footer Legal Links**: All footer legal items (Terms, Privacy, Fair Housing, Accessibility) use wouter `Link` components pointing to `/terms` and `/privacy` with hash anchors.

### Environment Variables Required

- `DATABASE_URL`
- `SESSION_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `ADMIN_EMAIL`
- `VITE_GOOGLE_MAPS_API_KEY`
- `IDX_RESO_CLIENT_ID`
- `IDX_RESO_CLIENT_SECRET`
- `IDX_REALTYFEED_API_KEY` (optional)
- `IDX_BROKER_API_KEY` (optional, legacy)