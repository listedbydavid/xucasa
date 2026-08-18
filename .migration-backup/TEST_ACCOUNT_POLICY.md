# Test Account Policy

## Account Source Classification

Every user account in the system has an `accountSource` field that classifies its origin:

| Value  | Description | Created By |
|--------|-------------|------------|
| `real` | Legitimate user accounts | User registration, Google OAuth |
| `test` | Manual test accounts | Developer testing |
| `seed` | Seeded demo data | `seedDatabase()` function |
| `e2e`  | End-to-end test accounts | Automated test suites |

## Rules for Test Accounts

### Development Environment
- Test accounts may be created freely for development and debugging
- The `seedDatabase()` function runs on startup to populate demo data
- All test accounts should be marked with the appropriate `accountSource` value

### Production Environment
- The `seedDatabase()` function is disabled and will not run
- Registration blocks known test email patterns (see ACCOUNT_CREATION_POLICY.md)
- Test accounts that exist in production should be identified and managed using the cleanup service

## Identifying Suspicious Accounts

The cleanup service (`server/cleanupService.ts`) identifies suspicious accounts by:
1. Email patterns matching known test domains (`@test.com`, `@example.com`, etc.)
2. Email patterns matching test prefixes (`e2e_*`, `test-*`, `dummy*`, `fake*`)
3. Accounts with `accountSource` set to anything other than `real`

## Admin Filtering

The admin user list endpoint (`GET /api/admin/users`) supports an `excludeTest=true` query parameter that filters out accounts where `accountSource` is not `real`. This allows admins to view only legitimate user accounts in their management views.

## Cleanup Procedures

See `CLEANUP_RUNBOOK.md` for step-by-step instructions on identifying and removing test accounts.
