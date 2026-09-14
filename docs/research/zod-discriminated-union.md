# Research: Zod discriminated union for role-based registration validation
Date: 2026-09-15
Task context: TASK-007 (auth service — register with role-discriminated fields)

## Question
BharatPure registration has 5 roles, each requiring different additional fields
(FARMER→fpo_name/registration_number/state/district/primary_crop_types, CONSUMER→delivery_pincode,
BULK_BUYER→company_name/gstin/business_type, LOGISTICS→vehicle_type/vehicle_registration_number,
ADMIN→admin_code). What's the correct Zod pattern to validate this in one schema, and does the
installed Zod version (4.6.5, not pinned by the project spec to a specific major) behave the way
`BHARATPURE-API.md`'s literal controller template assumes?

## Findings
- `z.discriminatedUnion('role', [schemaA, schemaB, ...])` is the correct API and works as expected
  in Zod 4.6.5 — verified directly with a throwaway script against the real 5-role field list
  before touching the real service code. Each branch schema declares `role: z.literal('FARMER')`
  etc.; Zod picks the matching branch from the `role` field and validates only that branch's shape,
  so a FARMER payload isn't checked against CONSUMER's fields and vice versa.
- **Breaking-change finding, not just a style note:** `BHARATPURE-API.md`'s controller template
  (line ~129) reads `parsed.error.errors` for the validation-details array passed to `sendError`.
  In Zod 4, `ZodError` no longer has an `.errors` property — it's `.issues`. Confirmed directly:
  `'errors' in parsed.error` → `false`, `'issues' in parsed.error` → `true`, and `.issues` contains
  the expected `{ code, path, message, ... }` array. If the literal template text were copied
  verbatim, `details` would silently be `undefined` on every validation error in production —
  not a crash, just silently useless error detail for the client. This is presumably because
  `BHARATPURE-API.md` was written against Zod 3 conventions before Zod 4 was released mid-2025.
- Each `.issues[].path` is an array (e.g. `['fpo_name']`) not a string — useful for field-level
  error mapping on the frontend later, no change needed there.
- No separate library install needed beyond the already-installed `zod` — no `zod-discriminated`
  helper package or anything like that exists; it's core to the library.

## Decision
- Use `z.discriminatedUnion('role', [...])` with one branch object per role.
- Use `parsed.error.issues` (not `.errors`) everywhere validation details are surfaced — this
  applies to every future controller too, not just auth, since the whole codebase shares the
  `BHARATPURE-API.md` controller template. Worth remembering when TASK-009 (auth routes/controllers)
  and every subsequent controller task is implemented.
- `admin_code` is validated as a plain non-empty string at the Zod layer; the actual comparison
  against `process.env.ADMIN_REGISTRATION_CODE` happens in the service layer (not inside the Zod
  schema), since Zod schemas should stay pure/stateless and not reach into `process.env` mid-parse.

## Sources
- Direct experimentation against the installed `zod@4.6.5` in `backend/node_modules` (see git
  history for the throwaway test script's output, not committed — ephemeral verification only).
- `BHARATPURE-API.md` lines 115–162 (controller template, response wrapper).
- `BHARATPURE-CLAUDE.md` role-specific registration field list.
- `chatbot.md` TASK-007 spec (exact required fields per role).
