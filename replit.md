# xucasa — Real Estate Listing Platform

## Overview

xucasa is a Redfin-inspired real estate web application for browsing, searching, saving, and listing properties. It offers a comprehensive platform for both buyers and agents, featuring an interactive map interface, detailed property pages with public records data, and an agent portal for managing listings. The platform aims to streamline the real estate process, offering tools like a client dashboard for buyers, a Sell Wizard for homeowners, and a reverse buyer marketplace. It also includes robust admin functionalities, agent verification, and PWA capabilities, ensuring an accessible and feature-rich user experience.

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
- **Maps**: Google Maps JavaScript API via `@react-google-maps/api`, utilizing AdvancedMarkerElements with custom price-bubble HTML markers and Street View Panorama.
- **URL Params**: `query-string` for serializing search filters into query strings.
- **Theme**: Dark mode supported with `ThemeToggle` component, persisting preference in localStorage.
- **Address Autocomplete**: Reusable component providing property suggestions with thumbnails and details.
- **Loading States**: Uses skeleton/shimmer loading states instead of spinners.
- **Mobile Responsiveness**: Fixed bottom contact bar, responsive grids, scaled typography.

### Backend

- **Framework**: Express.js (TypeScript, ESM).
- **API Design**: Route paths and Zod validation schemas defined in `shared/routes.ts` for client-server consistency.
- **Storage Layer**: `server/storage.ts` with `DatabaseStorage` class implementing `IStorage` interface, using Drizzle ORM for all DB queries.
- **Public Records**: `server/publicRecords.ts` integrates data from Census Geocoder, ACS, FEMA NFHL, and OpenStreetMap Overpass APIs.
- **Build**: Custom `script/build.ts` orchestrates Vite build for the client and esbuild for the server.

### Database

- **Database**: PostgreSQL.
- **ORM**: Drizzle ORM (`drizzle-orm/node-postgres`) with `drizzle-kit` for migrations.
- **Schema**: Includes tables for users, sessions, properties, saved properties/searches, search history, user homes, buyer profiles, buyer matches, seller pitches, swipe notifications, property offers, property reviews, agent_contacts, contact_tags, and contact_tag_assignments.

### Authentication

- **Providers**: Google OAuth 2.0 SSO via `passport-google-oauth20` AND email/password via bcryptjs.
- **Sessions**: `express-session` backed by PostgreSQL (`connect-pg-simple`) with secure/httpOnly cookies and a "Remember Me" option.
- **Roles**: Admin and Agent roles are supported. Admin account has email/password login (david@listedbydavid.com / 12345678) for testing without Google SSO.

### Core Features

- **Property Search & Filters**: Redfin-style search page with split layout: sticky map on the left, compact scrollable property list on the right. View mode toggle (Split/List/Map) in the filter bar. Compact horizontal property cards show thumbnail, price, beds/baths/sqft, address, property type, and days on market. Cross-highlight: hovering a card highlights its map marker (scale + shadow), hovering a map marker highlights its card. Hover preview panel slides up below the map showing property summary with image, price, address, specs, and View button. Filters in a single compact header row: price range, beds, baths, type, status, listing type, sort. Map view uses price-bubble markers showing formatted prices ("$1.2M", "$899K"). Map includes a Layers control panel (top-right) with: Standard/Satellite view toggle, and a Lot Lines overlay toggle that renders Regrid nationwide parcel boundary tiles (visible at zoom 14+). Parcel tiles sourced from ArcGIS Online Regrid service.
- **Property Cards**: Feature "New" badge (≤7 days), "Days on Market" with clock icon, always-visible pagination dots, photo counter ("1/24"), persistent photo position on mouse leave.
- **Hero Address Flow**: All three hero tabs (Buy, Sell, Estimate) use AddressAutocomplete. Sell and Estimate tabs pass typed address via `?address=` URL param to /sell and /home-report pages, which pre-fill their address fields. The Buy tab autocomplete shows both **location suggestions** (cities and counties with listing counts, queried dynamically from the `address_county` and `address_city` columns) and individual property matches. Selecting a city navigates to `/search?city=X`, selecting a county to `/search?county=X`. Backend: `GET /api/locations/autocomplete?q=...` returns grouped location suggestions, `GET /api/properties?city=X` filters by exact city match, `GET /api/properties?county=X` filters by exact county match on `address_county`. The `address_county` column is populated from RESO `CountyOrParish` during IDX sync.
- **Property Details**: Enhanced with mortgage calculator (with PMI auto-calculation when down payment < 20%), neighborhood insights, share and print options. Includes **Agent MLS Panel** for verified agents showing confidential remarks, showing instructions, lockbox/access info, listing/co-listing agent details, buyer agent compensation, and MLS documents.
- **Agent MLS View**: Confidential MLS data panel visible only to verified agents. Gated by `GET /api/properties/:id/agent-mls` (403 for non-agents). Data synced from RealtyFeed RESO fields: PrivateRemarks, ShowingInstructions, ShowingContactName/Phone, LockBoxType, AccessCode, ListAgentMlsId, ListAgentStateLicense, CoListAgent*, ListOfficeMlsId/Phone, BuyerAgencyCompensation, SpecialListingConditions, and Media documents. Component: `AgentMLSPanel.tsx`. Property cards show subtle indigo "MLS" badge for verified agents.
- **Buyer Marketplace**: Displays property listings alongside buyer profiles, with matching criteria.
- **Buyer Profile Management**: Shared modal for creating/editing buyer profiles.
- **Agent Beacon Report**: Generates branded PDF reports for agents, matching buyers to prospective listings.
- **Open House Route Planner**: Component for planning multi-stop routes to selected open houses using Google/Apple Maps.
- **Agent CRM (Contacts)**: Full contact management system in the Agent Dashboard "Contacts" tab. Features: contact list with search and tag filtering, add/edit contact modal, tag management (create, edit, delete tags with color coding), CSV import wizard (4-step: upload → field mapping with auto-guess → tag assignment → confirm), phone contacts import via browser Contact Picker API, and tag assignment/removal on contacts. All endpoints enforce tenant isolation (ownership checks). Tables: `agent_contacts`, `contact_tags`, `contact_tag_assignments`. Component: `AgentContacts.tsx`. API routes under `/api/agent/contacts` and `/api/agent/tags`.
- **Home Report**: Comprehensive Homebot-inspired property analysis tool. Features: Google autocomplete address input with MLS auto-fill, preview examples below Generate button, and a dark-themed report with sections for: Property Valuation (comps), Loan Confirmation ("That looks right" / "Change these numbers"), Net Worth/Equity, Recently Sold Nearby (from DB with property cards), "What's Important Now" (3 insight cards), Principal vs Interest Pie Chart, Extra Payment Savings Calculator, Refinance Comparison (30yr/15yr/5-1 ARM with years slider), Purchasing Power (4 scenarios), Home Equity with action cards, Airbnb Rental Estimate with nightly rate slider, Zoning & Building Potential, and Neighborhood Insights. API: `/api/recently-sold` returns nearby properties by lat/lng.
- **Sell Page Auto-Populate**: When a seller enters their address on the Sell page, `/api/property-lookup` searches the properties database by address components. If a matching MLS record is found, beds, baths, sqft, lot size, HOA, and property type are auto-filled into the form. A green banner confirms auto-fill on Step 2.
- **Reverse Offer / Swipe Interest System**: Facilitates buyer interest expression and reverse offer creation, with notifications for agents and admins based on representation status.
- **Property Ratings & Reviews**: Users with complete profiles (photo, verified email, phone, mailing address) can rate (1-5 stars) and comment (300 chars max) on properties. Listing agents and admins can toggle review visibility. An example review is displayed when no real reviews exist. Profile completeness gate shows inline fields to complete missing profile data. Routes: `GET/POST /api/properties/:id/reviews`, `PATCH /api/reviews/:id/visibility`, `DELETE /api/reviews/:id`, `GET /api/profile/completeness`, `PATCH /api/profile`. Component: `PropertyReviewSection.tsx`.
- **Error Tracking & Crash Reporting**: Automated production error monitoring system. Frontend (`errorTracker.ts`) auto-captures: uncaught JS errors, unhandled promise rejections, React ErrorBoundary crashes, and 5xx API errors. Each report includes: error type/message/stack, URL, user agent, session ID, user activity trail (last 30 breadcrumbs: clicks, navigations, network calls), and device metadata (viewport, online status, memory). Reports are batched and sent via `navigator.sendBeacon` (or `fetch` fallback). Backend deduplicates by message+URL, incrementing `occurrences` count for repeat errors. Rate limited to 20 reports/min per IP. Admin dashboard has an "Errors" tab showing all reports with: type/status badges, occurrence counts, expandable details (stack trace, component stack, user activity trail, device info), status management (new/investigating/resolved/ignored), admin notes, and delete. **Error Archive**: Resolved errors can be archived via "Archive Resolved" button — moves them from DB to `data/error-archive.json` (git-ignored) in timestamped batches. Archive viewer shows expandable batches with full error details. Download button exports the archive file. Archive operation uses DB transactions for atomicity and an in-memory lock to prevent concurrent writes. Routes: `POST /api/error-reports` (public), `GET/PATCH/DELETE /api/admin/error-reports` (admin-only), `POST/GET /api/admin/error-reports/archive`, `GET /api/admin/error-reports/archive/download`.
- **Notification System**: In-app notifications with bell icon in navbar showing unread count badge, dropdown panel with notification list (mark read, archive, delete per item, mark all read), and full management tab in Dashboard with filters (all/unread/archived) and preferences placeholder. Notification types: new_listing, price_drop, agent_match, open_house, system. Test notification seeder via `POST /api/notifications/test`. Routes: `GET /api/notifications`, `GET /api/notifications/unread-count`, `PATCH /api/notifications/mark-all-read`, `PATCH/DELETE /api/notifications/:id`. Component: `NotificationBell.tsx`. Dashboard section: `NotificationsSection` in `Dashboard.tsx`. DB table: `notifications`.
- **Legal & Compliance**: Cookie consent banner, Privacy Policy, and Terms of Service pages with fair housing and accessibility statements.
- **Progressive Web App (PWA)**: Full PWA support for iPhone/iPad "Add to Home Screen" experience. Includes: 18 Apple splash screen images for all device sizes, enhanced service worker with cache-first static assets + network-first API calls + offline fallback page, iOS safe area handling (notch/Dynamic Island), standalone mode back button in navbar, pull-to-refresh prevention, smart install banner for iOS Safari users (dismissible, 30-day cooldown), web manifest with full icon set (72-512px), screenshots, and categories. Component: `InstallPrompt.tsx`.

## External Dependencies

### APIs & Services

- **Google Maps JavaScript API**: For map display, Street View, and Places Autocomplete.
- **US Census Geocoder**: For geocoding addresses and FIPS codes.
- **US Census ACS5**: For neighborhood demographic and economic statistics.
- **FEMA NFHL**: For flood zone data.
- **OpenStreetMap Overpass API**: For nearby places information (schools, parks, etc.).
- **Google OAuth 2.0**: For user authentication.
- **RealtyFeed / MLS Sync**: Integrates with RealtyFeed (RESO OData) for MLS listing synchronization. Falls back to IDX Broker REST API.