---
name: xucasa port lessons
description: Key gotchas encountered when porting the xucasa legacy app into the pnpm monorepo workspace
---

## drizzle-zod version

drizzle-zod@0.8.x uses zod v4 types internally. The workspace catalog pins zod@^3.25.76.
Using drizzle-zod@0.8+ with zod v3 causes TS2344 errors ("ZodObject does not satisfy ZodType<any,any,any>").

**Fix:** Pin drizzle-zod to ^0.6.1 in any package that uses it with zod v3.
Also annotate createInsertSchema exports as `z.ZodTypeAny` to silence TS2742 "cannot be named" errors.

## esbuild externals (build.mjs)

The api-server build.mjs must list `pg` and `zod` in its `external` array.
They are not bundled by esbuild but must be resolvable at runtime. Without them, build fails with "Could not resolve".

**Why:** pg uses native bindings; zod uses catalog resolution — both must be runtime externals.

## User/UpsertUser types from @workspace/db

The `User` and `UpsertUser` types live in `lib/db/src/schema/models/auth.ts`.
They must be explicitly re-exported from `lib/db/src/schema/index.ts` using `export type { User, UpsertUser }`.
Using `export *` from models/auth causes duplicate `users`/`sessions` table exports (already re-exported by schema.ts).

## Security: /api/auth/user must strip passwordHash

The auth/user route returns the full DB user row. Must destructure out `passwordHash` and `adminNotes` before serializing.
Also: avoid capturing and logging JSON response bodies in Express middleware (logs PII).

## noImplicitReturns in legacy route files

Legacy Express route handlers use early-exit `return res.json()` patterns but no final return.
Set `"noImplicitReturns": false` in the api-server tsconfig.json to avoid hundreds of TS7030 errors
across route files — these are pre-existing patterns, not bugs.

## Orval integer schemas with Zod v3

Use OpenAPI `type: number` rather than `type: integer` for generated contracts while this workspace remains on Zod v3.

**Why:** The current Orval Zod generator emits `zod.int()` for OpenAPI integer fields, but that API only exists in Zod v4 and breaks shared-library typechecks.

**How to apply:** Keep stricter integer validation in handwritten server schemas where needed; use `number` for Orval-generated request and response fields until the workspace upgrades to Zod v4.
