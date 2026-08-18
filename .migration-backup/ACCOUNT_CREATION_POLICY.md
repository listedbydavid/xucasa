# Account Creation Policy

## Registration Rules

### Password Requirements
- Minimum 8 characters
- Must contain at least one uppercase letter (A-Z)
- Must contain at least one lowercase letter (a-z)
- Must contain at least one digit (0-9)

### Email Requirements
- Must be a valid email format
- Automatically trimmed and lowercased
- Duplicate emails are rejected

### Production Email Blocking
In production (`NODE_ENV=production`), registration is blocked for emails matching known test/disposable patterns:
- `@test.com`, `@example.com`, `@example.org`, `@example.net`
- `@mailinator.com`, `@tempmail.com`, `@throwaway.email`
- Emails starting with `e2e_`, `test-`, `dummy-`, `fake-`
- Any `@*.test` domain

The blocked patterns list is defined in `server/authMiddleware.ts` and can be updated as needed.

### Request Validation
- Registration and login request bodies are validated with strict Zod schemas
- Unknown/extra fields in the request body are rejected
- First and last name fields have a maximum length of 100 characters

## Rate Limiting

### Registration
- 5 requests per 15-minute window per IP address
- Progressive blocking after repeated attempts

### Login
- 10 requests per 15-minute window per IP address

### Onboarding
- 10 requests per 15-minute window per IP address

## Audit Logging
All authentication attempts are logged with:
- Action type (register, login)
- Result (success, validation_failed, blocked_email, duplicate_email, invalid_credentials, etc.)
- IP address
- Email address
- Timestamp

Rate-limited requests are also logged separately.

## Account Source Tracking
Every user account has an `accountSource` field that tracks how the account was created:
- `real` — Standard user registration (default)
- `test` — Test account created during development
- `seed` — Seeded by the database seeder
- `e2e` — Created by end-to-end test automation

This field is used for filtering in admin views and analytics.

## Seed Data Protection
The `seedDatabase()` function is gated to only run in non-production environments. If called in production, it logs a warning and skips execution.
