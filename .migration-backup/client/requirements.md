## Packages
query-string | To handle URL query parameters for advanced searches

## Notes
- Relies on Replit Auth for authentication (`/api/login` and `/api/logout`).
- Uses `useAuth` from `@/hooks/use-auth` automatically provided by integration.
- Dynamic images are mock placeholders from Unsplash if user doesn't upload.
- Tailwind config relies on CSS variables for colors. We will overwrite `index.css` with a stunning Redfin-inspired theme.
