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

### Authentication

- **Provider**: Google OAuth 2.0 SSO via `passport-google-oauth20`.
- **Strategy**: Google profile data (name, email, photo) stored in the `users` table; Google profile ID as user ID.
- **Sessions**: `express-session` backed by PostgreSQL (`connect-pg-simple`) with 1-week TTL secure/httpOnly cookies.
- **Admin detection**: Email-based via `ADMIN_EMAIL` environment variable.

## External Dependencies

### APIs & Services

- **Google Maps JavaScript API**: For map display, Street View, and Places Autocomplete.
- **US Census Geocoder**: For geocoding addresses and FIPS codes.
- **US Census ACS5**: For neighborhood demographic and economic statistics.
- **FEMA NFHL**: For flood zone data.
- **OpenStreetMap Overpass API**: For nearby places information (schools, parks, etc.).
- **Google OAuth 2.0**: For user authentication.
- **RealtyFeed / MLS Sync**: Integrates with RealtyFeed (RESO OData) for MLS listing synchronization, including geographic filtering, batch upserts, and status updates. Falls back to IDX Broker REST API if configured.

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