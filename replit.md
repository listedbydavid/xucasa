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
- **Maps**: Google Maps JavaScript API via `@react-google-maps/api`, utilizing AdvancedMarkerElements and Street View Panorama.
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
- **Schema**: Includes tables for users, sessions, properties, saved properties/searches, search history, user homes, buyer profiles, buyer matches, seller pitches, swipe notifications, property offers, and property reviews.

### Authentication

- **Providers**: Google OAuth 2.0 SSO via `passport-google-oauth20` AND email/password via bcryptjs.
- **Sessions**: `express-session` backed by PostgreSQL (`connect-pg-simple`) with secure/httpOnly cookies and a "Remember Me" option.
- **Roles**: Admin and Agent roles are supported.

### Core Features

- **Property Search & Filters**: Comprehensive search capabilities with filters for price, beds, baths, property type, status, and sorting.
- **Property Details**: Enhanced with mortgage calculator, neighborhood insights, share and print options.
- **Buyer Marketplace**: Displays property listings alongside buyer profiles, with matching criteria.
- **Buyer Profile Management**: Shared modal for creating/editing buyer profiles.
- **Agent Beacon Report**: Generates branded PDF reports for agents, matching buyers to prospective listings.
- **Open House Route Planner**: Component for planning multi-stop routes to selected open houses using Google/Apple Maps.
- **Home Report**: Comprehensive property analysis tool providing valuation, equity insights, zoning, and neighborhood data.
- **Reverse Offer / Swipe Interest System**: Facilitates buyer interest expression and reverse offer creation, with notifications for agents and admins based on representation status.
- **Property Ratings & Reviews**: Users with complete profiles (photo, verified email, phone, mailing address) can rate (1-5 stars) and comment (300 chars max) on properties. Listing agents and admins can toggle review visibility. An example review is displayed when no real reviews exist. Profile completeness gate shows inline fields to complete missing profile data. Routes: `GET/POST /api/properties/:id/reviews`, `PATCH /api/reviews/:id/visibility`, `DELETE /api/reviews/:id`, `GET /api/profile/completeness`, `PATCH /api/profile`. Component: `PropertyReviewSection.tsx`.
- **Legal & Compliance**: Cookie consent banner, Privacy Policy, and Terms of Service pages with fair housing and accessibility statements.

## External Dependencies

### APIs & Services

- **Google Maps JavaScript API**: For map display, Street View, and Places Autocomplete.
- **US Census Geocoder**: For geocoding addresses and FIPS codes.
- **US Census ACS5**: For neighborhood demographic and economic statistics.
- **FEMA NFHL**: For flood zone data.
- **OpenStreetMap Overpass API**: For nearby places information (schools, parks, etc.).
- **Google OAuth 2.0**: For user authentication.
- **RealtyFeed / MLS Sync**: Integrates with RealtyFeed (RESO OData) for MLS listing synchronization. Falls back to IDX Broker REST API.