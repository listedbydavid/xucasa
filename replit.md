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
- **ORM**: Drizzle ORM (`drizzle-orm/node-postgres`) with `drizzle-kit` for migrations.
- **Schema**: Includes tables for users, sessions, properties, saved items, search history, user homes, buyer/seller profiles, agent contacts, and notifications.

### Authentication

- **Providers**: Google OAuth 2.0 SSO and email/password via bcryptjs.
- **Sessions**: `express-session` backed by PostgreSQL with secure cookies and "Remember Me" option.
- **Roles**: Supports Admin and Agent roles.

## External Dependencies

### APIs & Services

- **Google Maps JavaScript API**: For map display, Street View, and Places Autocomplete.
- **US Census Geocoder**: For geocoding and FIPS codes.
- **US Census ACS5**: For neighborhood demographic and economic statistics.
- **FEMA NFHL**: For flood zone data.
- **OpenStreetMap Overpass API**: For nearby places information.
- **Google OAuth 2.0**: For user authentication.
- **RealtyFeed / MLS Sync**: Integrates with RealtyFeed (RESO OData) for MLS listing synchronization, with IDX Broker REST API as a fallback.