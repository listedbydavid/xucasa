# Cleanup Runbook

## Overview

This runbook documents how to identify, disable, and delete suspicious or test accounts from the xucasa platform using the admin cleanup API endpoints.

## Prerequisites

- You must be authenticated as an admin user (matching `ADMIN_EMAIL` environment variable)
- All endpoints require `isAuthenticated` and `isAdmin` middleware

## Step 1: List Suspicious Accounts

**Endpoint:** `POST /api/admin/cleanup/list`

**Authentication:** Admin required

**Description:** Returns all accounts matching test email patterns or with a non-"real" `accountSource`.

**Example:**
```bash
curl -X POST https://your-domain/api/admin/cleanup/list \
  -H "Cookie: connect.sid=YOUR_SESSION" \
  -H "Content-Type: application/json"
```

**Response:** Array of user objects matching suspicious patterns.

## Step 2: Review Accounts

Before taking any action, review each account to confirm it is truly a test account:
- Check the `email` field for test-like patterns
- Check `accountSource` — anything other than `real` is flagged
- Check `createdAt` to understand when the account was created
- Check `lastLoginAt` to see if the account has been used recently
- Use `GET /api/admin/users/:id` to see full account details and activity

## Step 3: Disable Accounts (Reversible)

**Endpoint:** `POST /api/admin/cleanup/disable`

**Authentication:** Admin required

**Request Body:**
```json
{
  "userIds": ["user-id-1", "user-id-2"],
  "reason": "Test account cleanup - April 2026"
}
```

**Behavior:**
- Sets `status` to `disabled` for each user
- Records the reason in `adminNotes`
- Logs all operations
- Protected users (admins, ADMIN_EMAIL) cannot be disabled

## Step 4: Delete Accounts (Irreversible)

**Endpoint:** `POST /api/admin/cleanup/delete`

**Authentication:** Admin required

**Request Body:**
```json
{
  "userIds": ["user-id-1", "user-id-2"],
  "confirm": true
}
```

**Behavior:**
- The `confirm: true` flag is required — requests without it are rejected
- Deletes all related records in the correct FK dependency order:
  1. saved_properties
  2. favorite_lists
  3. buyer_profiles
  4. user_homes
  5. search_history
  6. buyer_interest
  7. saved_searches
  8. messages (via conversations)
  9. showing_requests (via conversations)
  10. conversations
  11. property_offers
  12. swipe_notifications
  13. buyer_matches
  14. seller_pitches
  15. property_reviews
  16. notifications
  17. notification_preferences
  18. client_agent_links
  19. properties
  20. users
- Returns a summary of deleted records per table
- Protected users (admins, ADMIN_EMAIL) cannot be deleted
- Each step is logged for audit purposes

## Safety Measures

1. **Admin protection:** The system prevents deletion or disabling of admin accounts and the ADMIN_EMAIL user
2. **Explicit confirmation:** Delete operations require `confirm: true`
3. **Audit logging:** All cleanup operations are logged with timestamps, user IDs, and action details
4. **Non-destructive first:** Always disable accounts first, then delete only after confirming they are safe to remove

## Recommended Workflow

1. Run `POST /api/admin/cleanup/list` to see all suspicious accounts
2. Review each account manually
3. Disable accounts you want to remove: `POST /api/admin/cleanup/disable`
4. Wait a period (e.g., 1 week) to ensure no legitimate users are affected
5. Delete disabled accounts: `POST /api/admin/cleanup/delete` with `confirm: true`
