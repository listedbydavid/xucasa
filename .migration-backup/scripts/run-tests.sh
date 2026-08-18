#!/bin/bash
# Runs the integration test suite. Requires DATABASE_URL to point at a writable
# Postgres database (the suite cleans up after itself using fixed test IDs).
set -euo pipefail

npx tsx --test server/__tests__/*.test.ts
